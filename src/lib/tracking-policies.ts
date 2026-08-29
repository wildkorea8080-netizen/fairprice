import "server-only";

import type { Prisma, TrackingTier } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getTrackingConfidenceBoost } from "@/modules/deal-engine/domain/tracking-priority";
import {
  getTrackingIntervalMinutes,
  getTrackingTierByRank,
} from "@/modules/deal-engine/domain/tracking-tiers";

function calculatePolicy(product: {
  _count: { alertRules: number; clickLogs: number; favoriteUsers: number };
  createdAt: Date;
  discoveries: Array<{ source: string }>;
  isActive: boolean;
  isFeatured: boolean;
  variant: {
    dataQuality: {
      anomalousSamples: number;
      confidence: "COLLECTING" | "PRELIMINARY" | "RELIABLE";
    } | null;
  } | null;
}) {
  const reasons: Record<string, number | boolean | string> = {};
  let score = product.isActive ? 5 : 0;
  const ageDays = (Date.now() - product.createdAt.getTime()) / 86_400_000;

  if (ageDays <= 30) {
    reasons.recentProduct = 10;
    score += 10;
  }

  if (product._count.alertRules > 0) {
    reasons.activeAlerts = product._count.alertRules;
    score += Math.min(product._count.alertRules * 40, 80);
  }

  if (product._count.favoriteUsers > 0) {
    reasons.favorites = product._count.favoriteUsers;
    score += Math.min(product._count.favoriteUsers * 15, 30);
  }

  if (product._count.clickLogs > 0) {
    reasons.recentClicks = product._count.clickLogs;
    score += Math.min(product._count.clickLogs * 3, 30);
  }

  if (product.isFeatured) {
    reasons.featured = true;
    score += 20;
  }

  if (product.discoveries.some(({ source }) => source === "GOLDBOX")) {
    reasons.goldbox = true;
    score += 20;
  } else if (
    product.discoveries.some(({ source }) => source === "CATEGORY_BEST")
  ) {
    reasons.categoryBest = true;
    score += 10;
  }

  const anomalies = product.variant?.dataQuality?.anomalousSamples ?? 0;
  if (anomalies > 0) {
    reasons.anomalies = anomalies;
    score += Math.min(anomalies * 5, 15);
  }

  const confidence = product.variant?.dataQuality?.confidence;
  const confidenceBoost = getTrackingConfidenceBoost(confidence);
  if (confidenceBoost > 0 && confidence) {
    reasons.dataConfidence = confidence;
    reasons.confidenceBoost = confidenceBoost;
    score += confidenceBoost;
  }

  return {
    isEnabled: product.isActive,
    priorityScore: Math.min(score, 100),
    reasons: reasons as Prisma.InputJsonObject,
  };
}

export async function refreshTrackingPolicies() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for tracking policies.");
  }

  const recentClickCutoff = new Date(Date.now() - 7 * 86_400_000);
  const products = await prisma.product.findMany({
    include: {
      _count: {
        select: {
          alertRules: { where: { isActive: true } },
          clickLogs: { where: { createdAt: { gte: recentClickCutoff } } },
          favoriteUsers: true,
        },
      },
      discoveries: {
        select: { source: true },
      },
      variant: {
        include: { dataQuality: true },
      },
    },
    where: { variant: { isNot: null } },
  });
  const counts: Record<TrackingTier, number> = { A: 0, B: 0, C: 0, D: 0 };

  // Tiers are assigned by rank, not by absolute score. With little engagement
  // data the absolute scores compress into one band and every product lands in
  // the same middle tier - which is how 1,296 products ended up sharing one
  // thin collection budget and none reached RELIABLE. Ranking always spends
  // the budget on the relative top, however compressed the scores are.
  const scored = products
    .flatMap((product) =>
      product.variant
        ? [{ policy: calculatePolicy(product), variantId: product.variant.id }]
        : [],
    )
    .sort(
      (left, right) =>
        right.policy.priorityScore - left.policy.priorityScore ||
        left.variantId.localeCompare(right.variantId),
    );

  for (const [index, { policy, variantId }] of scored.entries()) {
    const tier = getTrackingTierByRank(index + 1);
    const data = {
      ...policy,
      intervalMinutes: getTrackingIntervalMinutes(tier),
      reasons: { ...policy.reasons, rank: index + 1 } as Prisma.InputJsonObject,
      tier,
    };
    counts[tier] += 1;
    await prisma.productTrackingPolicy.upsert({
      create: {
        ...data,
        productVariantId: variantId,
      },
      update: data,
      where: { productVariantId: variantId },
    });
  }

  return { counts, updated: scored.length };
}
