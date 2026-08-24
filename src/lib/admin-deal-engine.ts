import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export async function getAdminDealEngineOverview() {
  if (!isDatabaseConfigured()) return null;

  const now = new Date();
  const [analyses, events, deals, totalEvents, activeDeals] = await Promise.all([
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
  ]);

  return {
    activeDeals,
    analyses: analyses.sort(
      (left, right) =>
        right.score - left.score ||
        right.calculatedAt.getTime() - left.calculatedAt.getTime(),
    ),
    confidence: {
      collecting: analyses.filter(({ confidence }) => confidence === "COLLECTING").length,
      preliminary: analyses.filter(({ confidence }) => confidence === "PRELIMINARY").length,
      reliable: analyses.filter(({ confidence }) => confidence === "RELIABLE").length,
    },
    deals,
    events,
    totalEvents,
  };
}

