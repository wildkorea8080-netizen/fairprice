import "server-only";

import { selectDiverseProducts } from "@/lib/catalog/diverse-products";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import {
  DEFAULT_DEAL_SCORE_CONFIG,
  type DealScoreThresholds,
  type DealScoreWeights,
} from "@/modules/deal-engine/domain/deal-score";
import { getDataConfidenceProgress } from "@/modules/deal-engine/domain/data-confidence";

function readNumberRecord<T extends Record<string, number>>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => [
      key,
      typeof record[key] === "number" ? record[key] : fallbackValue,
    ]),
  ) as T;
}

export async function getAdminDealEngineOverview() {
  if (!isDatabaseConfigured()) return null;

  const now = new Date();
  const [analyses, events, deals, totalEvents, activeDeals, scoreConfigs, catalogProducts] = await Promise.all([
    prisma.dealAnalysisSnapshot.findMany({
      distinct: ["offerId"],
      include: {
        offer: {
          include: {
            dealEntity: {
              include: {
                shoppingVariant: {
                  include: { product: true },
                },
              },
            },
          },
        },
        scoreConfig: { select: { key: true, version: true } },
      },
      orderBy: [{ offerId: "asc" }, { calculatedAt: "desc" }],
      take: 120,
    }),
    prisma.dealEvent.findMany({
      include: {
        offer: {
          include: {
            dealEntity: {
              include: {
                shoppingVariant: {
                  include: { product: true },
                },
              },
            },
          },
        },
      },
      orderBy: { detectedAt: "desc" },
      take: 40,
    }),
    prisma.deal.findMany({
      include: {
        offer: {
          include: {
            dealEntity: {
              include: {
                shoppingVariant: {
                  include: { product: true },
                },
              },
            },
          },
        },
        primaryEvent: true,
      },
      orderBy: [{ startsAt: "desc" }, { rankScore: "desc" }],
      take: 30,
    }),
    prisma.dealEvent.count(),
    prisma.deal.count({
      where: { expiresAt: { gt: now }, status: "ACTIVE" },
    }),
    prisma.dealScoreConfig.findMany({
      orderBy: { version: "desc" },
      take: 10,
      where: { vertical: "SHOPPING" },
    }),
    prisma.product.findMany({
      include: { category: true },
      orderBy: [{ discountRate: "desc" }, { updatedAt: "desc" }],
      take: 120,
      where: {
        coupangExternalId: { not: null },
        isActive: true,
      },
    }),
  ]);

  const uniqueCatalogProducts = selectDiverseProducts({
    limit: catalogProducts.length,
    products: catalogProducts,
  });
  const homepagePreview = selectDiverseProducts({
    limit: 24,
    products: catalogProducts,
  });
  const categoryExposure = [...homepagePreview.reduce((counts, product) => {
    const key = product.category.name;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())]
    .map(([name, count]) => ({ count, name }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "ko-KR"));

  const configs = scoreConfigs.map((config) => ({
    ...config,
    thresholds: readNumberRecord<DealScoreThresholds>(
      config.thresholds,
      DEFAULT_DEAL_SCORE_CONFIG.thresholds,
    ),
    weights: readNumberRecord<DealScoreWeights>(
      config.weights,
      DEFAULT_DEAL_SCORE_CONFIG.weights,
    ),
  }));

  return {
    activeDeals,
    activeConfig: configs.find(({ isActive }) => isActive) ?? configs[0] ?? null,
    analyses: analyses
      .map((analysis) => ({
        ...analysis,
        confidenceProgress: getDataConfidenceProgress(
          analysis.confidence,
          analysis.sampleCount,
          analysis.trackingDays,
        ),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.calculatedAt.getTime() - left.calculatedAt.getTime(),
      ),
    confidence: {
      collecting: analyses.filter(({ confidence }) => confidence === "COLLECTING").length,
      preliminary: analyses.filter(({ confidence }) => confidence === "PRELIMINARY").length,
      reliable: analyses.filter(({ confidence }) => confidence === "RELIABLE").length,
    },
    configs,
    feedQuality: {
      candidateCount: catalogProducts.length,
      categoryExposure,
      duplicateCount: catalogProducts.length - uniqueCatalogProducts.length,
      previewCount: homepagePreview.length,
      uniqueCategoryCount: categoryExposure.length,
      uniqueProductCount: uniqueCatalogProducts.length,
    },
    deals,
    events,
    totalEvents,
  };
}
