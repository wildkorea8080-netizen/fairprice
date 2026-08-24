import "server-only";

import { markStaleCronRuns } from "@/lib/cron-pipeline";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

function getCount<T extends { _count: { _all: number } }>(
  rows: T[],
  key: keyof T,
  value: string,
) {
  const row = rows.find((item) => item[key] === value);
  return row?._count._all ?? 0;
}

export async function getAdminDashboardOverview() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  await markStaleCronRuns();

  const [
    activeProducts,
    hiddenProducts,
    featuredProducts,
    categories,
    priceHistories,
    avgDiscount,
    maxDiscount,
    clickLogs,
    jobs,
    notifications,
    keywords,
    latestCronRun,
    latestProducts,
    analyzedProducts,
    analyticsByConfidence,
    dealEvents,
    activeDeals,
    highScoreProducts,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: false } }),
    prisma.product.count({ where: { isActive: true, isFeatured: true } }),
    prisma.category.count(),
    prisma.productPriceHistory.count(),
    prisma.product.aggregate({
      _avg: { discountRate: true },
      where: { isActive: true },
    }),
    prisma.product.aggregate({
      _max: { discountRate: true },
      where: { isActive: true },
    }),
    prisma.clickLog.count(),
    prisma.collectionJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.notificationLog.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.keywordCandidate.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.cronRun.findFirst({
      orderBy: { startedAt: "desc" },
    }),
    prisma.product.findMany({
      include: { category: true },
      orderBy: [{ lastCheckedAt: "desc" }, { updatedAt: "desc" }],
      take: 8,
      where: { coupangExternalId: { not: null } },
    }),
    prisma.productDealAnalytics.count(),
    prisma.productDealAnalytics.groupBy({
      by: ["confidence"],
      _count: { _all: true },
    }),
    prisma.dealEvent.count(),
    prisma.deal.count({ where: { status: "ACTIVE" } }),
    prisma.productDealAnalytics.count({ where: { score: { gte: 80 } } }),
  ]);

  return {
    averageDiscount: Math.round(avgDiscount._avg.discountRate ?? 0),
    dealEngine: {
      activeDeals,
      analyzedProducts,
      collecting: getCount(
        analyticsByConfidence,
        "confidence",
        "COLLECTING",
      ),
      dealEvents,
      highScoreProducts,
      reliable:
        getCount(analyticsByConfidence, "confidence", "MEDIUM") +
        getCount(analyticsByConfidence, "confidence", "HIGH"),
    },
    categories,
    clickLogs,
    featuredProducts,
    hiddenProducts,
    highestDiscount: maxDiscount._max.discountRate ?? 0,
    jobs: {
      completed: getCount(jobs, "status", "COMPLETED"),
      failed: getCount(jobs, "status", "FAILED"),
      pending: getCount(jobs, "status", "PENDING"),
      running: getCount(jobs, "status", "RUNNING"),
    },
    keywords: {
      approved: getCount(keywords, "status", "APPROVED"),
      new: getCount(keywords, "status", "NEW"),
      rejected: getCount(keywords, "status", "REJECTED"),
    },
    latestCronRun,
    latestProducts,
    notifications: {
      failed: getCount(notifications, "status", "FAILED"),
      pending: getCount(notifications, "status", "PENDING"),
      sent: getCount(notifications, "status", "SENT"),
    },
    priceHistories,
    trackedProducts: activeProducts,
  };
}
