import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { refreshTrackedProduct } from "@/lib/coupang/tracker";

export type ProductRefreshSummary = {
  attempted: number;
  changed: number;
  due: number;
  failed: number;
  notFound: number;
  unchanged: number;
};

const DEFAULT_BUDGET = 25;

function clampBudget(value?: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_BUDGET;
  }

  return Math.min(Math.max(Math.floor(value ?? DEFAULT_BUDGET), 1), 100);
}

/**
 * Spends a fixed per-run budget re-observing the highest-priority tracked
 * products that are due. The budget - 25 checks per 30-minute pipeline run,
 * 1,200 a day - is what makes depth-over-breadth an actual budget rather than
 * an aspiration: the tier intervals are designed to demand ~1,100 checks a day
 * at the current catalog size, so the top of the ranking is always served and
 * overflow falls on the products the ranking already demoted.
 *
 * Every attempted product gets its nextCheckAt advanced, including failures -
 * a product whose title no longer surfaces itself would otherwise pin the top
 * of the due queue and starve everything behind it.
 */
export async function refreshDueTrackedProducts({
  budget,
  now = new Date(),
}: {
  budget?: number;
  now?: Date;
} = {}): Promise<ProductRefreshSummary> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for product refresh.");
  }

  const take = clampBudget(budget);
  const [due, policies] = await Promise.all([
    prisma.productTrackingPolicy.count({
      where: { isEnabled: true, nextCheckAt: { lte: now } },
    }),
    prisma.productTrackingPolicy.findMany({
      include: {
        productVariant: {
          select: {
            product: {
              select: { coupangExternalId: true, title: true },
            },
          },
        },
      },
      orderBy: [{ priorityScore: "desc" }, { nextCheckAt: "asc" }],
      take,
      where: {
        isEnabled: true,
        nextCheckAt: { lte: now },
        productVariant: {
          product: { is: { coupangExternalId: { not: null }, isActive: true } },
        },
      },
    }),
  ]);

  const summary: ProductRefreshSummary = {
    attempted: 0,
    changed: 0,
    due,
    failed: 0,
    notFound: 0,
    unchanged: 0,
  };

  for (const policy of policies) {
    const product = policy.productVariant.product;

    if (!product?.coupangExternalId) {
      continue;
    }

    summary.attempted += 1;

    try {
      const { status } = await refreshTrackedProduct({
        coupangExternalId: product.coupangExternalId,
        title: product.title,
      });

      if (status === "not_found") {
        summary.notFound += 1;
      } else if (status === "unchanged") {
        summary.unchanged += 1;
      } else {
        summary.changed += 1;
      }
    } catch {
      summary.failed += 1;
    }

    await prisma.productTrackingPolicy.update({
      data: {
        lastScheduledAt: now,
        nextCheckAt: new Date(now.getTime() + policy.intervalMinutes * 60_000),
      },
      where: { id: policy.id },
    });
  }

  return summary;
}
