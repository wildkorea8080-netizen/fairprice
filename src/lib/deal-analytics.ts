import "server-only";

import type { DataConfidence, DealVerdict, Prisma } from "@prisma/client";
import {
  calculateDealScore,
  DEFAULT_DEAL_SCORE_CONFIG,
  validateDealScoreConfig,
  type DealScoreConfig,
  type DealScoreThresholds,
  type DealScoreWeights,
} from "@/modules/deal-engine/domain/deal-score";
import { detectAndPersistOfferDeals } from "@/lib/deal-detector";

export const FAIR_SCORE_VERSION = "shopping-deal-score-v1";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function percentile(sorted: number[], ratio: number) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

function standardDeviation(values: number[], mean: number) {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNumbers<T extends Record<string, number>>(
  value: unknown,
  fallback: T,
): T {
  if (!isRecord(value)) return fallback;

  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => [
      key,
      typeof value[key] === "number" ? value[key] : fallbackValue,
    ]),
  ) as T;
}

function toDomainConfig(config: {
  key: string;
  thresholds: Prisma.JsonValue;
  version: number;
  weights: Prisma.JsonValue;
}): DealScoreConfig {
  const domainConfig = {
    key: config.key,
    thresholds: readNumbers<DealScoreThresholds>(
      config.thresholds,
      DEFAULT_DEAL_SCORE_CONFIG.thresholds,
    ),
    version: config.version,
    weights: readNumbers<DealScoreWeights>(
      config.weights,
      DEFAULT_DEAL_SCORE_CONFIG.weights,
    ),
  };

  validateDealScoreConfig(domainConfig);
  return domainConfig;
}

async function getActiveDealScoreConfig(
  tx: Prisma.TransactionClient,
  checkedAt: Date,
) {
  const config = await tx.dealScoreConfig.findFirst({
    orderBy: { version: "desc" },
    where: {
      effectiveFrom: { lte: checkedAt },
      isActive: true,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: checkedAt } }],
      vertical: "SHOPPING",
    },
  });

  if (config) {
    return { config, domainConfig: toDomainConfig(config) };
  }

  const created = await tx.dealScoreConfig.upsert({
    create: {
      effectiveFrom: checkedAt,
      isActive: true,
      key: DEFAULT_DEAL_SCORE_CONFIG.key,
      thresholds: DEFAULT_DEAL_SCORE_CONFIG.thresholds,
      version: DEFAULT_DEAL_SCORE_CONFIG.version,
      vertical: "SHOPPING",
      weights: DEFAULT_DEAL_SCORE_CONFIG.weights,
    },
    update: { isActive: true },
    where: {
      key_version: {
        key: DEFAULT_DEAL_SCORE_CONFIG.key,
        version: DEFAULT_DEAL_SCORE_CONFIG.version,
      },
    },
  });

  return { config: created, domainConfig: DEFAULT_DEAL_SCORE_CONFIG };
}

export function calculateDealAnalytics({
  checkedAt,
  confidence,
  config = DEFAULT_DEAL_SCORE_CONFIG,
  currentPrice,
  observations,
  trackingStartedAt,
}: {
  checkedAt: Date;
  confidence: DataConfidence;
  config?: DealScoreConfig;
  currentPrice: number;
  observations: Array<{ checkedAt: Date; price: number }>;
  trackingStartedAt: Date;
}) {
  const chronological = observations
    .filter(({ price }) => price > 0)
    .sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  const prices = chronological.map(({ price }) => price);
  const safePrices = prices.length > 0 ? prices : [currentPrice];
  const sorted = [...safePrices].sort((a, b) => a - b);
  const lowestPrice = sorted[0];
  const highestPrice = sorted.at(-1) ?? currentPrice;
  const medianPrice = percentile(sorted, 0.5);
  const p10Price = percentile(sorted, 0.1);
  const p25Price = percentile(sorted, 0.25);
  const p75Price = percentile(sorted, 0.75);
  const p90Price = percentile(sorted, 0.9);
  const hasPriceRange = highestPrice > lowestPrice;
  const previousPrice = chronological
    .slice(0, -1)
    .reverse()
    .find(({ price }) => price !== currentPrice)?.price;
  const averagePrice = Math.round(
    safePrices.reduce((sum, value) => sum + value, 0) / safePrices.length,
  );
  const pricePercentile = hasPriceRange
    ? clamp(
        Math.round(
          ((currentPrice - lowestPrice) / (highestPrice - lowestPrice)) * 100,
        ),
      )
    : 50;
  const volatility = Number(
    (
      (standardDeviation(safePrices, averagePrice) /
        Math.max(medianPrice, 1)) *
      100
    ).toFixed(2),
  );
  const sampleCount = safePrices.length;
  const trackingDays = Math.max(
    1,
    Math.ceil(
      (checkedAt.getTime() - trackingStartedAt.getTime()) / 86_400_000,
    ),
  );
  const latestObservationAt = chronological.at(-1)?.checkedAt ?? checkedAt;
  const freshnessHours = Math.max(
    0,
    Math.floor(
      (checkedAt.getTime() - latestObservationAt.getTime()) / 3_600_000,
    ),
  );
  const scoreResult = calculateDealScore(
    {
      averagePrice,
      confidence,
      currentPrice,
      historicalPercentile: pricePercentile,
      lowestPrice,
      previousPrice,
      sampleCount,
    },
    config,
  );
  const verdict: DealVerdict =
    confidence === "COLLECTING" || sampleCount < 5
      ? "COLLECTING"
      : scoreResult.score >= config.thresholds.deal
        ? "STRONG_DEAL"
        : scoreResult.score >= config.thresholds.good
          ? "DEAL"
          : hasPriceRange && currentPrice <= p10Price
            ? "LOWEST"
            : currentPrice <= p25Price
              ? "GOOD"
              : currentPrice > p75Price
                ? "WAIT"
                : "AVERAGE";
  const reasons: string[] = [];

  if (scoreResult.averageDropRate > 0) {
    reasons.push(`최근 평균가 대비 ${scoreResult.averageDropRate}% 낮음`);
  }
  if (scoreResult.dropVelocityRate > 0) {
    reasons.push(`직전 변동가 대비 ${scoreResult.dropVelocityRate}% 하락`);
  }
  if (hasPriceRange && currentPrice <= p10Price) {
    reasons.push("관측 가격 하위 10% 구간");
  }
  if (scoreResult.rawScore > scoreResult.score) {
    reasons.push(`데이터 신뢰도에 따라 ${scoreResult.confidenceCap}점으로 제한`);
  }
  if (sampleCount >= 5) reasons.push(`검증 관측 ${sampleCount}회 기반`);
  if (confidence !== "RELIABLE") {
    reasons.push("신뢰도 상승을 위해 관측을 더 수집하는 중");
  }

  return {
    averagePrice,
    calculatedAt: checkedAt,
    components: scoreResult.components as Prisma.InputJsonObject,
    confidence,
    confidenceCap: scoreResult.confidenceCap,
    currentPrice,
    dropVelocityRate: scoreResult.dropVelocityRate,
    freshnessHours,
    highestPrice,
    lowestPrice,
    lowestPriceProximity: scoreResult.lowestPriceProximity,
    medianDropRate: Math.round(scoreResult.averageDropRate),
    medianPrice,
    p10Price,
    p25Price,
    p75Price,
    p90Price,
    previousDropRate: Math.round(scoreResult.dropVelocityRate),
    previousPrice,
    pricePercentile,
    rawScore: scoreResult.rawScore,
    reasons: (reasons.length > 0
      ? reasons
      : ["가격 이력을 더 수집하는 중"]) as Prisma.InputJsonArray,
    sampleCount,
    score: scoreResult.score,
    scoreBand: scoreResult.band,
    scoreVersion: scoreResult.scoreVersion,
    trackingDays,
    verdict,
    volatility,
  };
}

function isSameUtcDay(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

export async function refreshVariantDealAnalytics(
  tx: Prisma.TransactionClient,
  productVariantId: string,
  currentPrice: number,
  checkedAt = new Date(),
) {
  const [quality, observations, variant, activeConfig] = await Promise.all([
    tx.productDataQuality.findUnique({ where: { productVariantId } }),
    tx.priceObservation.findMany({
      orderBy: { checkedAt: "asc" },
      select: { checkedAt: true, price: true },
      take: 1000,
      where: {
        isAnomaly: false,
        price: { not: null },
        productVariantId,
        status: "SUCCESS",
      },
    }),
    tx.productVariant.findUnique({
      select: {
        dealEntity: {
          select: {
            title: true,
            offers: {
              orderBy: { updatedAt: "desc" },
              select: { id: true },
              take: 1,
              where: { isActive: true },
            },
          },
        },
      },
      where: { id: productVariantId },
    }),
    getActiveDealScoreConfig(tx, checkedAt),
  ]);
  const analytics = calculateDealAnalytics({
    checkedAt,
    confidence: quality?.confidence ?? "COLLECTING",
    config: activeConfig.domainConfig,
    currentPrice,
    observations: observations.flatMap((observation) =>
      observation.price === null
        ? []
        : [{ ...observation, price: observation.price }],
    ),
    trackingStartedAt: quality?.trackingStartedAt ?? checkedAt,
  });
  const {
    averagePrice,
    confidenceCap,
    dropVelocityRate,
    lowestPriceProximity,
    rawScore,
    scoreBand,
    ...legacyProjection
  } = analytics;
  const projection = await tx.productDealAnalytics.upsert({
    create: { ...legacyProjection, productVariantId },
    update: legacyProjection,
    where: { productVariantId },
  });
  const offerId = variant?.dealEntity?.offers[0]?.id;

  if (!offerId) return projection;

  const latestSnapshot = await tx.dealAnalysisSnapshot.findFirst({
    orderBy: { calculatedAt: "desc" },
    select: {
      calculatedAt: true,
      currentPrice: true,
      score: true,
      scoreConfigId: true,
    },
    where: { offerId },
  });
  const shouldStoreSnapshot =
    !latestSnapshot ||
    latestSnapshot.currentPrice !== currentPrice ||
    latestSnapshot.score !== analytics.score ||
    latestSnapshot.scoreConfigId !== activeConfig.config.id ||
    !isSameUtcDay(latestSnapshot.calculatedAt, checkedAt);

  if (shouldStoreSnapshot) {
    await tx.dealAnalysisSnapshot.create({
      data: {
        averageDropRate: analytics.medianDropRate,
        averagePrice,
        calculatedAt: checkedAt,
        components: analytics.components,
        confidence: analytics.confidence,
        confidenceCap,
        currentPrice,
        dropVelocityRate,
        highestPrice: analytics.highestPrice,
        lowestPrice: analytics.lowestPrice,
        lowestPriceProximity,
        offerId,
        previousPrice: analytics.previousPrice,
        pricePercentile: analytics.pricePercentile,
        rawScore,
        reasons: analytics.reasons,
        sampleCount: analytics.sampleCount,
        score: analytics.score,
        scoreBand,
        scoreConfigId: activeConfig.config.id,
        trackingDays: analytics.trackingDays,
      },
    });
  }

  await detectAndPersistOfferDeals(tx, {
    averagePrice,
    checkedAt,
    confidence: analytics.confidence,
    currentPrice,
    history: observations.flatMap((observation) =>
      observation.price === null
        ? []
        : [{ checkedAt: observation.checkedAt, price: observation.price }],
    ),
    highDealScore: activeConfig.domainConfig.thresholds.special,
    offerId,
    previousPrice: analytics.previousPrice ?? undefined,
    score: analytics.score,
    title: variant?.dealEntity?.title ?? "상품 특가",
  });

  return projection;
}
