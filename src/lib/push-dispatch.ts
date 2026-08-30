import "server-only";

import { getUnannouncedDeals } from "@/lib/deal-announcements";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getVapidConfig } from "@/lib/push-config";
import { shouldPushDeal } from "@/lib/push-matching";
import { sendDealPush } from "@/lib/push-notifications";

export type PushDispatchSummary = {
  configured: boolean;
  deals: number;
  matched: number;
  removed: number;
  sent: number;
  skipped: number;
};

/** Deals per run. Caps a backlog from becoming one enormous send. */
const DEAL_BATCH = 10;

/**
 * Sends browser push for deals that have not been pushed yet.
 *
 * Runs as its own pipeline step rather than inside deal detection, because
 * detection happens in a database transaction and every push is a network
 * call to an external service - holding row locks open for that is how a
 * collection run turns into a stall.
 *
 * pushedAt is stamped whether or not anyone was subscribed. A deal with no
 * matching subscribers is done, not pending, and leaving it unstamped would
 * make every later run re-examine it forever.
 */
export async function dispatchDealPush(): Promise<PushDispatchSummary> {
  const summary: PushDispatchSummary = {
    configured: Boolean(getVapidConfig()),
    deals: 0,
    matched: 0,
    removed: 0,
    sent: 0,
    skipped: 0,
  };

  if (!isDatabaseConfigured() || !summary.configured) {
    return summary;
  }

  const now = new Date();
  const deals = await getUnannouncedDeals("pushedAt", DEAL_BATCH, async (dealId) => {
    // The offer has no shopping product behind it, so there is nothing to
    // link a subscriber to. Stamp it so it stops being reconsidered.
    summary.skipped += 1;
    await prisma.deal.update({
      data: { pushedAt: now },
      where: { id: dealId },
    });
  });

  summary.deals = deals.length + summary.skipped;

  if (deals.length === 0) {
    return summary;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    select: {
      auth: true,
      endpoint: true,
      failureCount: true,
      id: true,
      keyword: true,
      maxPrice: true,
      p256dh: true,
      productId: true,
    },
    where: { isActive: true },
  });

  for (const deal of deals) {
    const targets = subscriptions.filter((subscription) =>
      shouldPushDeal(
        {
          keyword: subscription.keyword,
          maxPrice: subscription.maxPrice,
          productId: subscription.productId,
        },
        {
          price: deal.price,
          productId: deal.productId,
          title: deal.title,
        },
      ),
    );

    summary.matched += targets.length;

    if (targets.length > 0) {
      const result = await sendDealPush(targets, {
        price: deal.price,
        productSlug: deal.slug,
        title: deal.headline ?? deal.title,
      });

      summary.removed += result.removed;
      summary.sent += result.sent;
    }

    await prisma.deal.update({
      data: { pushedAt: now },
      where: { id: deal.id },
    });
  }

  return summary;
}
