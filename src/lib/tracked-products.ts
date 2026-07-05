import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type TrackingOverview = {
  dealCandidates: number;
  latestProducts: Array<{
    categoryName: string;
    currentPrice: number;
    discountRate: number;
    id: string;
    lastCheckedAt: Date | null;
    matchedRules: string[];
    title: string;
  }>;
  priceChanges: number;
  trackedProducts: number;
};

export async function getTrackingOverview(): Promise<TrackingOverview | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const [trackedProducts, priceChanges, products, candidateProducts] =
    await Promise.all([
    prisma.product.count({
      where: { coupangExternalId: { not: null } },
    }),
    prisma.productPriceHistory.count({
      where: {
        product: { coupangExternalId: { not: null } },
      },
    }),
    prisma.product.findMany({
      include: {
        category: true,
        collectionRules: {
          include: { collectionRule: true },
        },
      },
      orderBy: { lastCheckedAt: "desc" },
      take: 10,
      where: { coupangExternalId: { not: null } },
    }),
    prisma.product.findMany({
      include: {
        collectionRules: {
          include: { collectionRule: true },
        },
      },
      where: {
        coupangExternalId: { not: null },
        isActive: true,
      },
    }),
  ]);
  const dealCandidates = candidateProducts.filter((product) =>
    product.collectionRules.some(
      ({ collectionRule }) =>
        collectionRule.isActive &&
        product.discountRate >= collectionRule.minDiscountRate,
    ),
  ).length;

  return {
    dealCandidates,
    latestProducts: products.map((product) => ({
      categoryName: product.category.name,
      currentPrice: product.currentPrice,
      discountRate: product.discountRate,
      id: product.id,
      lastCheckedAt: product.lastCheckedAt,
      matchedRules: product.collectionRules.map(
        ({ collectionRule }) => collectionRule.keyword,
      ),
      title: product.title,
    })),
    priceChanges: Math.max(priceChanges - trackedProducts, 0),
    trackedProducts,
  };
}
