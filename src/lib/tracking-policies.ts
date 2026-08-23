import "server-only";

import type { Prisma, TrackingTier } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const TIER_INTERVALS: Record<TrackingTier, number> = {
  A: 60,
  B: 180,
  C: 720,
  D: 10_080,
};

function getTier(score: number): TrackingTier {
  if (score >= 60) return "A";
  if (score >= 35) return "B";
  if (score >= 15) return "C";
  return "D";
}

function calculatePolicy(product: {
  _count: { alertRules: number; clickLogs: number; favoriteUsers: number };
  createdAt: Date;
  discoveries: Array<{ source: string }>;
  isActive: boolean;
  isFeatured: boolean;
  variant: { dataQuality: { anomalousSamples: number } | null } | null;
}) {
  const reasons: Record<string, number | boolean> = {};
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

  const priorityScore = Math.min(score, 100);
  const tier = getTier(priorityScore);

  return {
    intervalMinutes: TIER_INTERVALS[tier],
    isEnabled: product.isActive,
    priorityScore,
    reasons: reasons as Prisma.InputJsonObject,
    tier,
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

  for (const product of products) {
    if (!product.variant) continue;

    const policy = calculatePolicy(product);
    counts[policy.tier] += 1;
    await prisma.productTrackingPolicy.upsert({
      create: {
        ...policy,
        productVariantId: product.variant.id,
      },
      update: policy,
      where: { productVariantId: product.variant.id },
    });
  }

  return { counts, updated: products.length };
}
