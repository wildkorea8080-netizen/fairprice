import "server-only";

import webpush from "web-push";
import { getVapidConfig } from "@/lib/push-config";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import type { NormalizedPushSubscription } from "@/lib/push-subscription";

export type PushSendSummary = {
  configured: boolean;
  failed: number;
  inspected: number;
  removed: number;
  sent: number;
};

/** Endpoints rejected this many times are dropped rather than retried forever. */
const MAX_FAILURES = 3;

async function resolveProductId(slug: string | null) {
  if (!slug) {
    return null;
  }

  const product = await prisma.product.findUnique({
    select: { id: true },
    where: { slug },
  });

  return product?.id ?? null;
}

export async function savePushSubscription(
  subscription: NormalizedPushSubscription,
  userId?: string | null,
) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for push subscriptions.");
  }

  // The client sends a slug because DealProduct carries no id; resolve it here
  // so the stored row keeps a real foreign key.
  const data = {
    auth: subscription.auth,
    failureCount: 0,
    isActive: true,
    keyword: subscription.keyword,
    maxPrice: subscription.maxPrice,
    p256dh: subscription.p256dh,
    productId: await resolveProductId(subscription.productSlug),
    userId: userId ?? null,
  };

  // Browsers reissue the same endpoint when a subscription is renewed, so an
  // upsert reactivates a previously dropped one instead of erroring.
  return prisma.pushSubscription.upsert({
    create: { endpoint: subscription.endpoint, ...data },
    update: data,
    where: { endpoint: subscription.endpoint },
  });
}

export async function deactivatePushSubscription(endpoint: string) {
  if (!isDatabaseConfigured()) {
    return { count: 0 };
  }

  return prisma.pushSubscription.updateMany({
    data: { isActive: false },
    where: { endpoint },
  });
}

export type PushPayload = {
  productSlug: string;
  price: number;
  title: string;
};

function buildPayload(payload: PushPayload) {
  return JSON.stringify({
    body: `${new Intl.NumberFormat("ko-KR").format(payload.price)}원`,
    title: payload.title,
    url: `/products/${payload.productSlug}`,
  });
}

/**
 * Sends one deal to every active subscription watching it.
 *
 * A push endpoint that answers 404 or 410 is permanently gone - the browser
 * dropped the subscription - so it is deactivated immediately rather than
 * counted as a failure. Other errors increment a counter and only remove the
 * subscription after repeated rejection, which keeps a transient outage at a
 * push service from clearing the whole list.
 */
export async function sendDealPush(
  subscriptions: Array<{
    auth: string;
    endpoint: string;
    failureCount: number;
    id: string;
    p256dh: string;
  }>,
  payload: PushPayload,
): Promise<PushSendSummary> {
  const config = getVapidConfig();

  if (!config) {
    return {
      configured: false,
      failed: 0,
      inspected: subscriptions.length,
      removed: 0,
      sent: 0,
    };
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const body = buildPayload(payload);
  const summary: PushSendSummary = {
    configured: true,
    failed: 0,
    inspected: subscriptions.length,
    removed: 0,
    sent: 0,
  };

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { auth: subscription.auth, p256dh: subscription.p256dh },
        },
        body,
      );
      summary.sent += 1;
      await prisma.pushSubscription.update({
        data: { failureCount: 0, lastSentAt: new Date() },
        where: { id: subscription.id },
      });
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode: unknown }).statusCode)
          : 0;
      const gone = statusCode === 404 || statusCode === 410;
      const failureCount = subscription.failureCount + 1;

      if (gone || failureCount >= MAX_FAILURES) {
        summary.removed += 1;
        await prisma.pushSubscription.update({
          data: { failureCount, isActive: false },
          where: { id: subscription.id },
        });
      } else {
        summary.failed += 1;
        await prisma.pushSubscription.update({
          data: { failureCount },
          where: { id: subscription.id },
        });
      }
    }
  }

  return summary;
}
