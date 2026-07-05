import { getDeploymentMode } from "@/lib/app-config";
import { markStaleCronRuns } from "@/lib/cron-pipeline";
import { areCoupangCredentialsConfigured } from "@/lib/coupang/client";
import { getEmailConfig } from "@/lib/email";
import { isLegalConfigReady } from "@/lib/legal-config";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const AUTOMATION_FRESHNESS_MS = 60 * 60 * 1000;
const PRICE_FRESHNESS_MS = 24 * 60 * 60 * 1000;

async function canReachDatabase() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function getAutomationHealth(databaseReachable: boolean) {
  if (!databaseReachable) {
    return {
      fresh: false,
      lastRunAt: null,
      minutesSinceLastRun: null,
      staleRunsMarked: 0,
      status: "unavailable",
    };
  }

  const staleRunsMarked = await markStaleCronRuns();
  const latestRun = await prisma.cronRun.findFirst({
    orderBy: { startedAt: "desc" },
  });

  if (!latestRun) {
    return {
      fresh: false,
      lastRunAt: null,
      minutesSinceLastRun: null,
      staleRunsMarked,
      status: "never-run",
    };
  }

  const ageMs = Date.now() - latestRun.startedAt.getTime();
  const fresh = latestRun.status === "SUCCESS" && ageMs <= AUTOMATION_FRESHNESS_MS;

  return {
    fresh,
    lastRunAt: latestRun.startedAt.toISOString(),
    minutesSinceLastRun: Math.max(0, Math.floor(ageMs / 60000)),
    staleRunsMarked,
    status: latestRun.status,
  };
}

async function getPriceTrackingHealth(databaseReachable: boolean) {
  if (!databaseReachable) {
    return {
      fresh: false,
      latestPriceHistoryAt: null,
      latestProductCheckedAt: null,
      minutesSinceLatestPriceHistory: null,
      minutesSinceLatestProductCheck: null,
      status: "unavailable",
    };
  }

  const [latestPriceHistory, latestCheckedProduct] = await Promise.all([
    prisma.productPriceHistory.findFirst({
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
    prisma.product.findFirst({
      orderBy: { lastCheckedAt: "desc" },
      select: { lastCheckedAt: true },
      where: {
        isActive: true,
        lastCheckedAt: { not: null },
      },
    }),
  ]);

  const latestPriceHistoryAt = latestPriceHistory?.checkedAt ?? null;
  const latestProductCheckedAt = latestCheckedProduct?.lastCheckedAt ?? null;
  const priceHistoryAgeMs = latestPriceHistoryAt
    ? Date.now() - latestPriceHistoryAt.getTime()
    : null;
  const productCheckAgeMs = latestProductCheckedAt
    ? Date.now() - latestProductCheckedAt.getTime()
    : null;
  const fresh = Boolean(
    priceHistoryAgeMs !== null &&
      productCheckAgeMs !== null &&
      priceHistoryAgeMs <= PRICE_FRESHNESS_MS &&
      productCheckAgeMs <= PRICE_FRESHNESS_MS,
  );

  return {
    fresh,
    latestPriceHistoryAt: latestPriceHistoryAt?.toISOString() ?? null,
    latestProductCheckedAt: latestProductCheckedAt?.toISOString() ?? null,
    minutesSinceLatestPriceHistory:
      priceHistoryAgeMs === null
        ? null
        : Math.max(0, Math.floor(priceHistoryAgeMs / 60000)),
    minutesSinceLatestProductCheck:
      productCheckAgeMs === null
        ? null
        : Math.max(0, Math.floor(productCheckAgeMs / 60000)),
    status: fresh ? "fresh" : "stale",
  };
}

export async function GET() {
  const mode = getDeploymentMode();
  const databaseConfigured = isDatabaseConfigured();
  const databaseReachable = await canReachDatabase();
  const automation = await getAutomationHealth(databaseReachable);
  const priceTracking = await getPriceTrackingHealth(databaseReachable);
  const coupangPartnersConfigured = areCoupangCredentialsConfigured();
  const emailConfigured = getEmailConfig().isConfigured;
  const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);
  const cronSecretConfigured = Boolean(
    process.env.CRON_SECRET?.trim() &&
      process.env.CRON_SECRET.trim().length >= 32,
  );
  const legalConfigured = isLegalConfigReady();
  const productionServicesConfigured = Boolean(
    databaseReachable &&
      appUrlConfigured &&
      coupangPartnersConfigured &&
      emailConfigured &&
      cronSecretConfigured &&
      legalConfigured,
  );

  return Response.json(
    {
      checks: {
        appUrl: appUrlConfigured,
        coupangPartners: coupangPartnersConfigured,
        cronSecret: cronSecretConfigured,
        database: databaseReachable,
        databaseConfigured,
        email: emailConfigured,
        legal: legalConfigured,
        automationFresh: automation.fresh,
        priceTrackingFresh: priceTracking.fresh,
        productionServices: productionServicesConfigured,
      },
      automation,
      mode,
      priceTracking,
      service: "fairprice",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
