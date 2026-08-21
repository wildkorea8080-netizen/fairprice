import "server-only";

import { products as sampleProducts, type Product } from "@/data/catalog";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

type PricePoint = {
  checkedAt: Date;
  price: number;
};

export type DealInsight = {
  averageObservedPrice: number;
  badge: string;
  confidence: "low" | "medium" | "high";
  dealScore: number;
  dropFromHighRate: number;
  isLowestObserved: boolean;
  lowestObservedPrice: number;
  observedHighPrice: number;
  observedSamples: number;
  pricePercentile: number;
  previousPrice?: number;
  previousPriceDropRate: number;
  reasons: string[];
  trackingDays: number;
  verdict: "collecting" | "lowest" | "good" | "average" | "wait";
};

export type DealProduct = Product & {
  dealInsight: DealInsight;
  imageUrl?: string | null;
  lastCheckedAt?: Date | null;
  priceHistory: PricePoint[];
  source: "database" | "sample";
};

const imageTones = [
  "bg-gradient-to-br from-emerald-50 to-sky-100",
  "bg-gradient-to-br from-rose-50 to-amber-100",
  "bg-gradient-to-br from-cyan-50 to-lime-100",
  "bg-gradient-to-br from-indigo-50 to-slate-100",
  "bg-gradient-to-br from-teal-50 to-orange-100",
];

function getImageTone(slug: string) {
  const total = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return imageTones[total % imageTones.length];
}

export function formatKoreanPrice(price: number) {
  return `${new Intl.NumberFormat("ko-KR").format(price)}원`;
}

function calculateRate(referencePrice: number, currentPrice: number) {
  if (referencePrice <= 0 || currentPrice >= referencePrice) {
    return 0;
  }

  return Math.round(((referencePrice - currentPrice) / referencePrice) * 100);
}

function getConfidence(sampleCount: number): DealInsight["confidence"] {
  if (sampleCount >= 8) {
    return "high";
  }

  if (sampleCount >= 3) {
    return "medium";
  }

  return "low";
}

function getDealBadge(
  score: number,
  insight: Omit<DealInsight, "badge" | "confidence">,
) {
  if (score >= 80) {
    return "강력 특가";
  }

  if (score >= 60) {
    return "특가 후보";
  }

  if (insight.previousPriceDropRate >= 10) {
    return "가격 급락";
  }

  if (insight.isLowestObserved) {
    return "관측 최저가";
  }

  return "가격 추적중";
}

function getVerdict({
  averageObservedPrice,
  currentPrice,
  dropFromHighRate,
  isLowestObserved,
  observedSamples,
}: {
  averageObservedPrice: number;
  currentPrice: number;
  dropFromHighRate: number;
  isLowestObserved: boolean;
  observedSamples: number;
}): DealInsight["verdict"] {
  if (observedSamples < 3) return "collecting";
  if (isLowestObserved) return "lowest";
  if (dropFromHighRate >= 10 || currentPrice <= averageObservedPrice * 0.95) return "good";
  if (currentPrice >= averageObservedPrice * 1.08) return "wait";
  return "average";
}

function buildReasons({
  dropFromHighRate,
  isLowestObserved,
  observedSamples,
  previousPriceDropRate,
}: {
  dropFromHighRate: number;
  isLowestObserved: boolean;
  observedSamples: number;
  previousPriceDropRate: number;
}) {
  const reasons: string[] = [];

  if (dropFromHighRate > 0) {
    reasons.push(`관측 최고가 대비 ${dropFromHighRate}% 낮음`);
  }

  if (previousPriceDropRate > 0) {
    reasons.push(`직전가 대비 ${previousPriceDropRate}% 하락`);
  }

  if (isLowestObserved) {
    reasons.push("현재가가 관측 최저가");
  }

  if (observedSamples >= 3) {
    reasons.push(`가격 이력 ${observedSamples}회 기반`);
  }

  return reasons.length > 0 ? reasons : ["가격 이력을 더 수집하는 중"];
}

function buildDealInsight({
  currentPrice,
  history,
  originalPrice,
}: {
  currentPrice: number;
  history: PricePoint[];
  originalPrice: number;
}): DealInsight {
  const prices = [originalPrice, currentPrice, ...history.map(({ price }) => price)]
    .filter((price) => price > 0);
  const observedHighPrice = Math.max(...prices);
  const lowestObservedPrice = Math.min(...prices);
  const averageObservedPrice = Math.round(
    prices.reduce((sum, price) => sum + price, 0) / prices.length,
  );
  const pricePercentile = Math.round(
    ((currentPrice - lowestObservedPrice) /
      Math.max(observedHighPrice - lowestObservedPrice, 1)) *
      100,
  );
  const timestamps = history.map(({ checkedAt }) => checkedAt.getTime());
  const trackingDays = timestamps.length
    ? Math.max(1, Math.ceil((Date.now() - Math.min(...timestamps)) / 86_400_000))
    : 1;
  const previousPrice = history.find(({ price }) => price !== currentPrice)?.price;
  const dropFromHighRate = calculateRate(observedHighPrice, currentPrice);
  const previousPriceDropRate = previousPrice
    ? calculateRate(previousPrice, currentPrice)
    : 0;
  const isLowestObserved = currentPrice <= lowestObservedPrice;
  const observedSamples = history.length + 1;
  const confidence = getConfidence(observedSamples);
  const dealScore = Math.min(
    Math.round(
      dropFromHighRate * 2.4 +
        previousPriceDropRate * 3 +
        (isLowestObserved ? 16 : 0) +
        Math.min(observedSamples, 12) * 1.5,
    ),
    100,
  );
  const insightWithoutBadge = {
    averageObservedPrice,
    dealScore,
    dropFromHighRate,
    isLowestObserved,
    lowestObservedPrice,
    observedHighPrice,
    observedSamples,
    pricePercentile,
    previousPrice,
    previousPriceDropRate,
    reasons: buildReasons({
      dropFromHighRate,
      isLowestObserved,
      observedSamples,
      previousPriceDropRate,
    }),
    trackingDays,
    verdict: getVerdict({
      averageObservedPrice,
      currentPrice,
      dropFromHighRate,
      isLowestObserved,
      observedSamples,
    }),
  };

  return {
    ...insightWithoutBadge,
    badge: getDealBadge(dealScore, insightWithoutBadge),
    confidence,
  };
}

function sampleDealInsight(product: Product): DealInsight {
  return buildDealInsight({
    currentPrice: product.price,
    history: [],
    originalPrice: product.originalPrice,
  });
}

function sampleDealProducts() {
  return sampleProducts.map((product) => ({
    ...product,
    dealInsight: sampleDealInsight(product),
    priceHistory: [],
    source: "sample" as const,
  }));
}

async function getDatabaseProducts(limit: number) {
  return prisma.product.findMany({
    include: {
      category: true,
      collectionRules: {
        include: { collectionRule: true },
      },
      priceHistories: {
        orderBy: { checkedAt: "desc" },
        take: 30,
      },
    },
    orderBy: [
      { discountRate: "desc" },
      { updatedAt: "desc" },
      { currentPrice: "asc" },
    ],
    take: Math.min(Math.max(limit, 1), 120),
    where: {
      coupangExternalId: { not: null },
      isActive: true,
    },
  });
}

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function productMatchesSearch(product: DealProduct, searchQuery?: string) {
  const query = normalizeSearchText(searchQuery ?? "");

  if (!query) {
    return true;
  }

  return normalizeSearchText(
    [product.title, product.brand, product.category.name, product.description].join(" "),
  ).includes(query);
}

function mapDatabaseProduct(product: Awaited<ReturnType<typeof getDatabaseProducts>>[number]) {
  const matchedRule = product.collectionRules.find(
    ({ collectionRule }) => collectionRule.isActive,
  )?.collectionRule;
  const priceHistory = product.priceHistories.map(({ checkedAt, price }) => ({
    checkedAt,
    price,
  }));
  const dealInsight = buildDealInsight({
    currentPrice: product.currentPrice,
    history: priceHistory,
    originalPrice: product.originalPrice,
  });

  return {
    brand: product.brand ?? matchedRule?.keyword ?? "Coupang",
    category: {
      description: `${product.category.name} 카테고리의 쿠팡 가격 추적 상품입니다.`,
      name: product.category.name,
      slug: product.category.slug,
    },
    coupangUrl: product.coupangUrl,
    dealInsight,
    description:
      product.description ??
      "쿠팡 파트너스 API로 수집하고 가격 변동을 추적 중인 상품입니다.",
    discountRate: dealInsight.dropFromHighRate,
    imageTone: getImageTone(product.slug),
    imageUrl: product.imageUrl,
    lastCheckedAt: product.lastCheckedAt,
    originalPrice: dealInsight.observedHighPrice,
    partnerUrl: product.partnerUrl,
    price: product.currentPrice,
    priceHistory,
    slug: product.slug,
    source: "database" as const,
    title: product.title,
  };
}

function filterDealProducts(
  products: DealProduct[],
  {
    categorySlug,
    minDiscountRate,
    searchQuery,
  }: {
    categorySlug?: string;
    minDiscountRate?: number;
    searchQuery?: string;
  },
) {
  return products
    .filter((product) => !categorySlug || product.category.slug === categorySlug)
    .filter((product) => productMatchesSearch(product, searchQuery))
    .filter(
      (product) =>
        !minDiscountRate ||
        minDiscountRate <= 0 ||
        product.discountRate >= minDiscountRate,
    )
    .sort(
      (a, b) =>
        b.dealInsight.dealScore - a.dealInsight.dealScore ||
        b.discountRate - a.discountRate ||
        a.price - b.price,
    );
}

export async function getDealProducts({
  categorySlug,
  limit = 80,
  minDiscountRate,
  searchQuery,
}: {
  categorySlug?: string;
  limit?: number;
  minDiscountRate?: number;
  searchQuery?: string;
} = {}): Promise<DealProduct[]> {
  if (!isDatabaseConfigured()) {
    return filterDealProducts(sampleDealProducts(), {
      categorySlug,
      minDiscountRate,
      searchQuery,
    });
  }

  try {
    const dbProducts = await getDatabaseProducts(limit);

    if (dbProducts.length === 0) {
      return filterDealProducts(sampleDealProducts(), {
        categorySlug,
        minDiscountRate,
        searchQuery,
      });
    }

    return filterDealProducts(dbProducts.map(mapDatabaseProduct), {
      categorySlug,
      minDiscountRate,
      searchQuery,
    });
  } catch {
    return filterDealProducts(sampleDealProducts(), {
      categorySlug,
      minDiscountRate,
      searchQuery,
    });
  }
}

export async function getDealProductBySlug(
  slug: string,
): Promise<DealProduct | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    const product = await prisma.product.findUnique({
      include: {
        category: true,
        collectionRules: {
          include: { collectionRule: true },
        },
        priceHistories: {
          orderBy: { checkedAt: "desc" },
          take: 30,
        },
      },
      where: { slug },
    });

    if (!product || !product.isActive) {
      return null;
    }

    return mapDatabaseProduct(product);
  } catch {
    return null;
  }
}

export async function getRelatedDealProducts(
  product: DealProduct,
  limit = 8,
): Promise<DealProduct[]> {
  if (!isDatabaseConfigured() || product.source !== "database") return [];

  try {
    const candidates = (await getDatabaseProducts(120))
      .map(mapDatabaseProduct)
      .filter((candidate) => candidate.slug !== product.slug)
      .map((candidate) => {
        const priceGap = Math.abs(candidate.price - product.price) / Math.max(product.price, 1);
        const score =
          (candidate.category.slug === product.category.slug ? 40 : 0) +
          (candidate.brand === product.brand ? 20 : 0) +
          Math.max(0, Math.round(20 - priceGap * 40)) +
          Math.round(candidate.dealInsight.dealScore * 0.2);

        return { candidate, score };
      })
      .sort((a, b) => b.score - a.score || b.candidate.dealInsight.dealScore - a.candidate.dealInsight.dealScore)
      .slice(0, Math.min(Math.max(limit, 1), 12));

    return candidates.map(({ candidate }) => candidate);
  } catch {
    return [];
  }
}
