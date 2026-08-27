import "server-only";

import { getAppUrl } from "@/lib/app-config";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/unsubscribe-token";

function getUnsubscribeSecret() {
  return process.env.FAIRPRICE_AUTH_SECRET ?? "fairprice-local-dev-auth-secret";
}

export function createUnsubscribeUrl(userId: string) {
  const token = createUnsubscribeToken(userId, getUnsubscribeSecret());

  return `${getAppUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function createOneClickUnsubscribeUrl(userId: string) {
  const token = createUnsubscribeToken(userId, getUnsubscribeSecret());

  return `${getAppUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

export type UnsubscribeResult = {
  deactivated: number;
  status: "invalid" | "ok";
};

/**
 * Deactivates every alert rule for the token's user. Rules are kept so the
 * subscriber can turn them back on from /alerts instead of rebuilding them.
 */
export async function unsubscribeAllAlerts(
  token: string,
): Promise<UnsubscribeResult> {
  const userId = verifyUnsubscribeToken(token, getUnsubscribeSecret());

  if (!userId) {
    return { deactivated: 0, status: "invalid" };
  }

  if (!isDatabaseConfigured()) {
    return { deactivated: 0, status: "invalid" };
  }

  const result = await prisma.alertRule.updateMany({
    data: { isActive: false },
    where: { isActive: true, userId },
  });

  return { deactivated: result.count, status: "ok" };
}
