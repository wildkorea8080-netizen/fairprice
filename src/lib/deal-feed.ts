import "server-only";

import {
  getProductDedupeKeys,
  selectDiverseProducts,
} from "@/lib/catalog/diverse-products";
import { getDealProducts, type DealProduct } from "@/lib/deal-products";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type DealFeedKind = "hot" | "drop" | "lowest" | "recent";

export type DealFeedItem = {
  dealId: string;
  detectedAt: Date;
  eventLabel: string;
  eventType: string;
  kind: DealFeedKind;
  product: DealProduct;
  rankScore: number;
  score: number;
  verification: "OBSERVED" | "VERIFIED";
};

export type DealFeedSection = {
  description: string;
  items: DealFeedItem[];
  key: DealFeedKind;
  title: string;
};

const sectionCopy: Record<DealFeedKind, Pick<DealFeedSection, "description" | "title">> = {
  hot: {
    description: "신뢰도와 가격 이력, 활성 초특가 기준을 통과한 상품입니다.",
    title: "오늘의 HOT DEAL",
  },
  drop: {
    description: "최근 평균가 또는 직전 관측가보다 빠르게 내려간 상품입니다.",
    title: "가격 급락",
  },
  lowest: {
    description: "30일·90일 최저가와 역대 최저가에 가까운 상품입니다.",
    title: "최저가 신호",
  },
  recent: {
    description: "Deal Engine이 가장 최근에 포착한 가격 신호입니다.",
    title: "방금 발견된 특가",
  },
};

function getFeedKind(eventType: string): DealFeedKind {
  if (eventType === "RAPID_DROP" || eventType === "AVERAGE_DROP") return "drop";
  if (["LOWEST_30D", "LOWEST_90D", "NEAR_ALL_TIME_LOW"].includes(eventType)) return "lowest";
  return "hot";
}

function getEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    AVERAGE_DROP: "평균가 대비 하락",
    HIGH_DEAL_SCORE: "고득점 특가",
    LOWEST_30D: "30일 최저가",
    LOWEST_90D: "90일 최저가",
    NEAR_ALL_TIME_LOW: "역대 최저가 근접",
    RAPID_DROP: "단기 급락",
  };

  return labels[eventType] ?? "가격 특가 신호";
}

export async function getActiveDealFeed(limit = 40): Promise<DealFeedItem[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const now = new Date();
    const deals = await prisma.deal.findMany({
      include: {
        offer: {
          include: {
            dealEntity: {
              include: {
                shoppingVariant: {
                  select: { productId: true },
                },
              },
            },
          },
        },
        primaryEvent: true,
      },
      orderBy: [{ rankScore: "desc" }, { startsAt: "desc" }],
      take: Math.min(Math.max(limit, 1), 100),
      where: {
        startsAt: { lte: now },
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    const productIds = new Set(
      deals
        .map(({ offer }) => offer.dealEntity.shoppingVariant?.productId)
        .filter((id): id is string => Boolean(id)),
    );

    if (productIds.size === 0) return [];

    const products = await getDealProducts({
      limit: productIds.size,
      productIds: [...productIds],
    });
    const productsById = new Map(
      (await prisma.product.findMany({
        select: { id: true, slug: true },
        where: { id: { in: [...productIds] } },
      })).map(({ id, slug }) => [id, products.find((product) => product.slug === slug)]),
    );

    return deals.flatMap((deal) => {
      const productId = deal.offer.dealEntity.shoppingVariant?.productId;
      const product = productId ? productsById.get(productId) : undefined;

      if (!product) return [];

      const eventType = deal.primaryEvent?.eventType ?? "HIGH_DEAL_SCORE";
      return [{
        dealId: deal.id,
        detectedAt: deal.primaryEvent?.detectedAt ?? deal.startsAt,
        eventLabel: getEventLabel(eventType),
        eventType,
        kind: getFeedKind(eventType),
        product,
        rankScore: deal.rankScore,
        score: deal.score,
        verification: "VERIFIED" as const,
      }];
    });
  } catch {
    // Deployments can serve the legacy catalog safely until the additive migration runs.
    return [];
  }
}

export async function getRecentDealSignals(limit = 20): Promise<DealFeedItem[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const now = new Date();
    const events = await prisma.dealEvent.findMany({
      include: {
        offer: {
          include: {
            dealEntity: {
              include: {
                shoppingVariant: {
                  select: { productId: true },
                },
              },
            },
          },
        },
      },
      orderBy: { detectedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 60),
      where: {
        detectedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    const productIds = new Set(
      events
        .map(({ offer }) => offer.dealEntity.shoppingVariant?.productId)
        .filter((id): id is string => Boolean(id)),
    );

    if (productIds.size === 0) return [];

    const products = await getDealProducts({ limit: 120 });
    const productsById = new Map(
      (await prisma.product.findMany({
        select: { id: true, slug: true },
        where: { id: { in: [...productIds] } },
      })).map(({ id, slug }) => [id, products.find((product) => product.slug === slug)]),
    );

    return events.flatMap((event) => {
      const productId = event.offer.dealEntity.shoppingVariant?.productId;
      const product = productId ? productsById.get(productId) : undefined;

      if (!product) return [];

      return [{
        dealId: `signal-${event.id}`,
        detectedAt: event.detectedAt,
        eventLabel: getEventLabel(event.eventType),
        eventType: event.eventType,
        kind: getFeedKind(event.eventType),
        product,
        rankScore: event.score ?? 0,
        score: event.score ?? product.dealInsight.dealScore,
        verification: "OBSERVED" as const,
      }];
    });
  } catch {
    return [];
  }
}

export function buildDealFeedSections(items: DealFeedItem[]): DealFeedSection[] {
  const observedOnly = items.length > 0 && items.every(({ verification }) => verification === "OBSERVED");
  const usedProductKeys = new Set<string>();
  const sections: DealFeedSection[] = (["hot", "drop", "lowest"] as DealFeedKind[])
    .map((key) => {
      const candidates = items.filter((item) => item.kind === key);
      const products = selectDiverseProducts({
        excludedKeys: usedProductKeys,
        // Two rows per section rather than one. These sections are the home
        // page's main content, and four cards read as a sample of the feed
        // rather than the feed itself.
        limit: 8,
        products: candidates.map((item) => item.product),
      });
      const selectedSlugs = new Set(products.map(({ slug }) => slug));
      const sectionItems = candidates.filter(({ product }) => selectedSlugs.has(product.slug));

      sectionItems.forEach(({ product }) => {
        getProductDedupeKeys(product).forEach((dedupeKey) => usedProductKeys.add(dedupeKey));
      });

      return { ...sectionCopy[key], items: sectionItems, key };
    })
    .map((section) => observedOnly
      ? { ...section, description: `${section.description} 충분한 가격 이력이 쌓일 때까지 검증 중으로 표시됩니다.` }
      : section)
    .filter(({ items: sectionItems }) => sectionItems.length > 0);

  if (items.length > 0) {
    const recentCandidates = [...items].sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    const recentProducts = selectDiverseProducts({
      excludedKeys: usedProductKeys,
      limit: 4,
      products: recentCandidates.map((item) => item.product),
    });
    const recentSlugs = new Set(recentProducts.map(({ slug }) => slug));
    const recentItems = recentCandidates.filter(({ product }) => recentSlugs.has(product.slug));

    if (recentItems.length === 0) return sections;

    sections.push({
      ...sectionCopy.recent,
      description: observedOnly
        ? "Deal Engine이 최근 포착한 검증 전 가격 신호입니다. 확정 Hot Deal과 구분해 표시합니다."
        : sectionCopy.recent.description,
      items: recentItems,
      key: "recent",
    });
  }

  return sections;
}
