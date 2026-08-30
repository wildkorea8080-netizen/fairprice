import "server-only";

import { getUnannouncedDeals } from "@/lib/deal-announcements";
import { getAppUrl } from "@/lib/app-config";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getTelegramConfig } from "@/lib/telegram-config";
import { buildDealMessage } from "@/lib/telegram-message";

export type TelegramDispatchSummary = {
  configured: boolean;
  deals: number;
  failed: number;
  posted: number;
  skipped: number;
};

/** Deals per run - also a courtesy to channel readers and to rate limits. */
const DEAL_BATCH = 5;

async function stampDeal(dealId: string, now: Date) {
  await prisma.deal.update({
    data: { telegramPostedAt: now },
    where: { id: dealId },
  });
}

/**
 * Posts newly activated deals to the Telegram channel.
 *
 * A failed post is NOT stamped, unlike browser push: push failures are
 * per-subscriber and tracked on the subscription, but here one API call
 * serves the whole channel, so leaving the stamp null lets the next run retry
 * a transient Telegram outage. What bounds retries is the deal's own
 * expiry - the query only selects unexpired deals - so a permanently failing
 * post stops being attempted when the deal lapses after 48 hours.
 */
export async function dispatchTelegramDeals(): Promise<TelegramDispatchSummary> {
  const config = getTelegramConfig();
  const summary: TelegramDispatchSummary = {
    configured: Boolean(config),
    deals: 0,
    failed: 0,
    posted: 0,
    skipped: 0,
  };

  if (!isDatabaseConfigured() || !config) {
    return summary;
  }

  const now = new Date();
  const appUrl = getAppUrl();
  const deals = await getUnannouncedDeals("telegramPostedAt", DEAL_BATCH, async (dealId) => {
    summary.skipped += 1;
    await stampDeal(dealId, now);
  });

  summary.deals = deals.length + summary.skipped;

  for (const deal of deals) {
    const message = buildDealMessage({
      discountRate: deal.discountRate,
      headline: deal.headline,
      price: deal.price,
      productUrl: `${appUrl}/products/${deal.slug}`,
      title: deal.title,
    });

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${config.botToken}/sendMessage`,
        {
          body: JSON.stringify({
            chat_id: config.chatId,
            disable_web_page_preview: false,
            parse_mode: "HTML",
            text: message,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );

      if (!response.ok) {
        summary.failed += 1;
        continue;
      }

      summary.posted += 1;
      await stampDeal(deal.id, now);
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
