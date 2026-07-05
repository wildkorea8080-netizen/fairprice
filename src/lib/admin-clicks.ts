import "server-only";

import type { Prisma } from "@prisma/client";
import {
  ensureKeywordSource,
  normalizeKeyword,
  upsertKeywordCandidate,
} from "@/lib/keyword-candidates";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type ClickAnalyticsPeriod = "1" | "7" | "30" | "all";
export type ClickUserFilter = "all" | "authenticated" | "anonymous";

type ClickAnalyticsOptions = {
  period?: ClickAnalyticsPeriod;
  query?: string;
  userFilter?: ClickUserFilter;
};

type CreateClickKeywordCandidatesOptions = {
  limit?: number;
  period?: ClickAnalyticsPeriod;
};

const KEYWORD_STOP_WORDS = new Set([
  "coupang",
  "for",
  "new",
  "the",
  "with",
  "골드박스",
  "무료배송",
  "로켓배송",
  "로켓프레시",
  "쿠팡",
  "특가",
  "할인",
]);

function startOfDay(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function normalizeQuery(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function clampLimit(value?: number) {
  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.min(Math.max(Math.floor(value ?? 10), 1), 30);
}

function tokenizeProductTitle(title: string) {
  return title
    .replace(/[()[\]{}|/\\,+:;'"`~!@#$%^&*_=?<>]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => {
      const normalized = normalizeKeyword(token);

      return (
        normalized.length >= 2 &&
        !/^\d+$/.test(normalized) &&
        !KEYWORD_STOP_WORDS.has(normalized)
      );
    })
    .slice(0, 6);
}

function buildCandidateKeywords(product: {
  brand: string | null;
  category: { name: string };
  title: string;
}) {
  const keywords = new Set<string>();

  if (product.brand) {
    keywords.add(product.brand);
  }

  keywords.add(product.category.name);

  for (const token of tokenizeProductTitle(product.title)) {
    keywords.add(token);
  }

  return [...keywords].slice(0, 8);
}

function buildClickWhere({
  period = "7",
  query,
  userFilter = "all",
}: ClickAnalyticsOptions): Prisma.ClickLogWhereInput {
  const where: Prisma.ClickLogWhereInput = {};
  const normalizedQuery = normalizeQuery(query);

  if (period !== "all") {
    where.createdAt = { gte: startOfDay(Number(period)) };
  }

  if (normalizedQuery) {
    where.OR = [
      {
        sourcePage: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      {
        product: {
          is: {
            title: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
        },
      },
      {
        product: {
          is: {
            category: {
              is: {
                name: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      },
      {
        user: {
          is: {
            email: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  if (userFilter === "authenticated") {
    where.userId = { not: null };
  }

  if (userFilter === "anonymous") {
    where.userId = null;
  }

  return where;
}

export async function getClickAnalyticsOverview(
  options: ClickAnalyticsOptions = {},
) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const period = options.period ?? "7";
  const query = normalizeQuery(options.query);
  const userFilter = options.userFilter ?? "all";
  const breakdownWhere = buildClickWhere({ period, query });
  const where = buildClickWhere({ period, query, userFilter });
  const since7Days = startOfDay(7);
  const since1Day = startOfDay(1);

  const [
    totalClicks,
    filteredClicks,
    filteredAuthenticatedClicks,
    filteredAnonymousClicks,
    clicks7Days,
    clicks24Hours,
    latestClicks,
    topProducts,
    sourceGroups,
  ] = await Promise.all([
    prisma.clickLog.count(),
    prisma.clickLog.count({ where }),
    prisma.clickLog.count({
      where: { ...breakdownWhere, userId: { not: null } },
    }),
    prisma.clickLog.count({ where: { ...breakdownWhere, userId: null } }),
    prisma.clickLog.count({ where: { createdAt: { gte: since7Days } } }),
    prisma.clickLog.count({ where: { createdAt: { gte: since1Day } } }),
    prisma.clickLog.findMany({
      include: {
        product: {
          include: { category: true },
        },
        user: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      where,
    }),
    prisma.clickLog.groupBy({
      by: ["productId"],
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: 10,
      where,
    }),
    prisma.clickLog.groupBy({
      by: ["sourcePage"],
      _count: { _all: true },
      orderBy: { _count: { sourcePage: "desc" } },
      take: 10,
      where,
    }),
  ]);

  const productMap = new Map(
    (
      await prisma.product.findMany({
        include: { category: true },
        where: { id: { in: topProducts.map((item) => item.productId) } },
      })
    ).map((product) => [product.id, product]),
  );

  return {
    clicks24Hours,
    clicks7Days,
    filteredAnonymousClicks,
    filteredAuthenticatedClicks,
    filteredClicks,
    latestClicks,
    period,
    query,
    sourceCounts: sourceGroups
      .map((source) => ({
        count: source._count._all,
        source: source.sourcePage || "unknown",
      }))
      .sort((a, b) => b.count - a.count),
    topProducts: topProducts.map((item) => ({
      clicks: item._count._all,
      product: productMap.get(item.productId) ?? null,
      productId: item.productId,
    })),
    totalClicks,
    userFilter,
  };
}

export async function createKeywordCandidatesFromTopClicks({
  limit = 10,
  period = "30",
}: CreateClickKeywordCandidatesOptions = {}) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for click keyword extraction.");
  }

  const where = buildClickWhere({ period });
  const topProducts = await prisma.clickLog.groupBy({
    by: ["productId"],
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: clampLimit(limit),
    where,
  });

  if (topProducts.length === 0) {
    return {
      candidates: 0,
      products: 0,
    };
  }

  const source = await ensureKeywordSource(
    "USER_ACTIVITY",
    "Affiliate click signals",
    95,
  );
  const clickCountByProductId = new Map(
    topProducts.map((item) => [item.productId, item._count._all]),
  );
  const products = await prisma.product.findMany({
    include: { category: true },
    where: { id: { in: topProducts.map((item) => item.productId) } },
  });

  let candidates = 0;

  for (const product of products) {
    const clicks = clickCountByProductId.get(product.id) ?? 1;
    const score = Math.min(60 + clicks * 10 + product.discountRate, 300);

    for (const keyword of buildCandidateKeywords(product)) {
      const candidate = await upsertKeywordCandidate({
        keyword,
        note: `클릭 상품 기반: ${product.title}`,
        score,
        sourceId: source.id,
        sourceKey: `click:${product.id}:${normalizeKeyword(keyword)}`,
        sourceType: "USER_ACTIVITY",
      });

      if (candidate) {
        candidates += 1;
      }
    }
  }

  return {
    candidates,
    products: products.length,
  };
}
