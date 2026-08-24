import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { searchCoupangProducts } from "@/lib/coupang/client";
import {
  normalizeCoupangProduct,
  type ImportedProductCandidate,
} from "@/lib/coupang/normalize";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { refreshVariantDealAnalytics } from "@/lib/deal-analytics";
import { normalizeProductUnit } from "@/lib/catalog/unit-normalizer";

const MAX_COUPANG_COLLECTION_LIMIT = 10;

export type CollectionSummary = {
  changed: number;
  created: number;
  keyword: string;
  minDiscountRate?: number;
  received: number;
  unchanged: number;
};

function getCategorySlug(name: string) {
  const digest = createHash("sha1").update(name).digest("hex").slice(0, 10);
  return `coupang-${digest}`;
}

function getProductSlug(product: ImportedProductCandidate) {
  return `coupang-${product.externalProductKey.replaceAll(":", "-")}`;
}

function getCoupangUrl(product: ImportedProductCandidate) {
  const url = new URL(
    `https://www.coupang.com/vp/products/${product.productId}`,
  );

  if (product.itemId) {
    url.searchParams.set("itemId", product.itemId);
  }

  if (product.vendorItemId) {
    url.searchParams.set("vendorItemId", product.vendorItemId);
  }

  return url.toString();
}

function calculateDiscountRate(referencePrice: number, currentPrice: number) {
  if (referencePrice <= 0 || currentPrice >= referencePrice) {
    return 0;
  }

  return Math.round(((referencePrice - currentPrice) / referencePrice) * 100);
}

function normalizeCatalogTitle(title: string) {
  return title.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

type ObservationAssessment = {
  confirmedObservationId?: string;
  isAnomaly: boolean;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function getUtcDayRange(value: Date) {
  const start = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
  const end = new Date(start.getTime() + 86_400_000);

  return { end, start };
}

async function syncDailyPriceAggregate(
  tx: Prisma.TransactionClient,
  offerId: string,
  checkedAt: Date,
) {
  const { end, start } = getUtcDayRange(checkedAt);
  const observations = await tx.priceObservation.findMany({
    orderBy: { checkedAt: "asc" },
    select: {
      checkedAt: true,
      isAvailable: true,
      price: true,
    },
    where: {
      checkedAt: { gte: start, lt: end },
      isAnomaly: false,
      offerId,
      price: { not: null },
      status: "SUCCESS",
    },
  });
  const prices = observations.map(({ price }) => price as number);

  if (prices.length === 0) {
    return;
  }

  await tx.dailyPriceAggregate.upsert({
    create: {
      availableCount: observations.filter(({ isAvailable }) => isAvailable)
        .length,
      closePrice: prices.at(-1) as number,
      date: start,
      highestPrice: Math.max(...prices),
      lastObservedAt: observations.at(-1)?.checkedAt ?? checkedAt,
      lowestPrice: Math.min(...prices),
      medianPrice: Math.round(median(prices)),
      offerId,
      openPrice: prices[0],
      sampleCount: prices.length,
    },
    update: {
      availableCount: observations.filter(({ isAvailable }) => isAvailable)
        .length,
      closePrice: prices.at(-1) as number,
      highestPrice: Math.max(...prices),
      lastObservedAt: observations.at(-1)?.checkedAt ?? checkedAt,
      lowestPrice: Math.min(...prices),
      medianPrice: Math.round(median(prices)),
      openPrice: prices[0],
      sampleCount: prices.length,
    },
    where: { offerId_date: { date: start, offerId } },
  });
}

async function assessPriceObservation(
  tx: Prisma.TransactionClient,
  compatibilityProductId: string,
  price: number,
): Promise<ObservationAssessment> {
  const variant = await tx.productVariant.findUnique({
    include: {
      observations: {
        orderBy: { checkedAt: "desc" },
        take: 20,
        where: { status: "SUCCESS" },
      },
    },
    where: { productId: compatibilityProductId },
  });
  const latest = variant?.observations[0];

  if (
    latest?.isAnomaly &&
    latest.price &&
    Math.abs(price - latest.price) <= Math.max(latest.price * 0.02, 100)
  ) {
    return {
      confirmedObservationId: latest.id,
      isAnomaly: false,
    };
  }

  const baseline =
    variant?.observations
      .filter((observation) => !observation.isAnomaly && observation.price)
      .map((observation) => observation.price as number) ?? [];

  if (baseline.length < 5) {
    return { isAnomaly: false };
  }

  const baselineMedian = median(baseline);
  const deviations = baseline.map((value) => Math.abs(value - baselineMedian));
  const medianAbsoluteDeviation = median(deviations);
  const anomalyThreshold = Math.max(
    baselineMedian * 0.45,
    medianAbsoluteDeviation * 4,
  );

  return {
    isAnomaly: Math.abs(price - baselineMedian) > anomalyThreshold,
  };
}

function getDataConfidence(validSamples: number, trackingDays: number) {
  if (validSamples >= 20 && trackingDays >= 30) {
    return "RELIABLE" as const;
  }

  if (validSamples >= 5 && trackingDays >= 7) {
    return "PRELIMINARY" as const;
  }

  return "COLLECTING" as const;
}

async function syncCatalogObservation(
  tx: Prisma.TransactionClient,
  compatibilityProductId: string,
  product: ImportedProductCandidate,
  categoryId: string,
  checkedAt: Date,
  referencePrice: number,
  assessment: ObservationAssessment,
  requestId?: string,
) {
  const normalizedUnit = normalizeProductUnit(product.title);
  const groupSlug = `coupang-product-${product.productId}`;
  const group = await tx.productGroup.upsert({
    create: {
      categoryId,
      imageUrl: product.imageUrl,
      normalizedTitle: normalizeCatalogTitle(product.title),
      slug: groupSlug,
      title: product.title,
    },
    update: {
      categoryId,
      imageUrl: product.imageUrl,
      normalizedTitle: normalizeCatalogTitle(product.title),
      title: product.title,
    },
    where: { slug: groupSlug },
  });
  const entityCanonicalKey = `coupang:${product.externalProductKey}`;
  const dealEntity = await tx.dealEntity.upsert({
    create: {
      canonicalKey: entityCanonicalKey,
      entityType: "SHOPPING_PRODUCT",
      imageUrl: product.imageUrl,
      isActive: true,
      metadata: { categoryName: product.categoryName },
      normalizedTitle: normalizeCatalogTitle(product.title),
      title: product.title,
    },
    update: {
      imageUrl: product.imageUrl,
      isActive: true,
      metadata: { categoryName: product.categoryName },
      normalizedTitle: normalizeCatalogTitle(product.title),
      title: product.title,
    },
    where: {
      entityType_canonicalKey: {
        canonicalKey: entityCanonicalKey,
        entityType: "SHOPPING_PRODUCT",
      },
    },
  });

  const variant = await tx.productVariant.upsert({
    create: {
      coupangItemId: product.itemId,
      coupangProductId: product.productId,
      coupangVendorItemId: product.vendorItemId,
      dealEntityId: dealEntity.id,
      externalKey: product.externalProductKey,
      isActive: true,
      optionName: product.title,
      ...(normalizedUnit ?? {}),
      productGroupId: group.id,
      productId: compatibilityProductId,
    },
    update: {
      coupangItemId: product.itemId,
      coupangProductId: product.productId,
      coupangVendorItemId: product.vendorItemId,
      dealEntityId: dealEntity.id,
      externalKey: product.externalProductKey,
      isActive: true,
      optionName: product.title,
      ...(normalizedUnit ?? {}),
      productGroupId: group.id,
    },
    where: { productId: compatibilityProductId },
  });
  const offer = await tx.offer.upsert({
    create: {
      affiliateUrl: product.partnerUrl,
      availability: "AVAILABLE",
      currency: "KRW",
      dealEntityId: dealEntity.id,
      externalKey: product.externalProductKey,
      isActive: true,
      lastObservedAt: checkedAt,
      metadata: {
        isFreeShipping: product.isFreeShipping,
        isRocket: product.isRocket,
      },
      source: "COUPANG",
      sourceUrl: getCoupangUrl(product),
    },
    update: {
      affiliateUrl: product.partnerUrl,
      availability: "AVAILABLE",
      dealEntityId: dealEntity.id,
      isActive: true,
      lastObservedAt: checkedAt,
      metadata: {
        isFreeShipping: product.isFreeShipping,
        isRocket: product.isRocket,
      },
      sourceUrl: getCoupangUrl(product),
    },
    where: {
      source_externalKey: {
        externalKey: product.externalProductKey,
        source: "COUPANG",
      },
    },
  });

  if (assessment.confirmedObservationId) {
    await tx.priceObservation.update({
      data: { isAnomaly: false },
      where: { id: assessment.confirmedObservationId },
    });
  }

  await tx.priceObservation.create({
    data: {
      checkedAt,
      affiliateUrl: product.partnerUrl,
      currency: "KRW",
      isAnomaly: assessment.isAnomaly,
      isAvailable: true,
      originalPrice: referencePrice,
      offerId: offer.id,
      price: product.price,
      productVariantId: variant.id,
      requestId,
      source: "COUPANG_PARTNERS",
      status: "SUCCESS",
    },
  });

  if (!assessment.isAnomaly) {
    await syncDailyPriceAggregate(tx, offer.id, checkedAt);
  }

  const [observedSamples, validSamples, anomalousSamples, trackingRange] =
    await Promise.all([
      tx.priceObservation.count({
        where: { productVariantId: variant.id },
      }),
      tx.priceObservation.count({
        where: {
          isAnomaly: false,
          productVariantId: variant.id,
          status: "SUCCESS",
        },
      }),
      tx.priceObservation.count({
        where: { isAnomaly: true, productVariantId: variant.id },
      }),
      tx.priceObservation.aggregate({
        _min: { checkedAt: true },
        where: { productVariantId: variant.id },
      }),
    ]);
  const trackingStartedAt = trackingRange._min.checkedAt ?? checkedAt;
  const trackingDays = Math.max(
    1,
    Math.ceil(
      (checkedAt.getTime() - trackingStartedAt.getTime()) / 86_400_000,
    ),
  );

  await tx.productDataQuality.upsert({
    create: {
      anomalousSamples,
      confidence: getDataConfidence(validSamples, trackingDays),
      latestCheckedAt: checkedAt,
      latestSuccessAt: checkedAt,
      observedSamples,
      productVariantId: variant.id,
      trackingStartedAt,
      validSamples,
    },
    update: {
      anomalousSamples,
      confidence: getDataConfidence(validSamples, trackingDays),
      consecutiveFailures: 0,
      latestCheckedAt: checkedAt,
      latestSuccessAt: checkedAt,
      observedSamples,
      trackingStartedAt,
      validSamples,
    },
    where: { productVariantId: variant.id },
  });

  if (!assessment.isAnomaly) {
    await refreshVariantDealAnalytics(tx, variant.id, product.price, checkedAt);
  }
}

async function persistProduct(
  product: ImportedProductCandidate,
  checkedAt: Date,
  collectionRuleId?: string,
  requestId?: string,
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const category = await tx.category.upsert({
      create: {
        name: product.categoryName,
        slug: getCategorySlug(product.categoryName),
      },
      update: {
        isActive: true,
        name: product.categoryName,
      },
      where: { slug: getCategorySlug(product.categoryName) },
    });
    const existing = await tx.product.findUnique({
      where: { coupangExternalId: product.externalProductKey },
    });

    if (!existing) {
      const assessment = { isAnomaly: false };
      const created = await tx.product.create({
        data: {
          categoryId: category.id,
          coupangExternalId: product.externalProductKey,
          coupangItemId: product.itemId,
          coupangProductId: product.productId,
          coupangUrl: getCoupangUrl(product),
          coupangVendorItemId: product.vendorItemId,
          currentPrice: product.price,
          discountRate: 0,
          imageUrl: product.imageUrl,
          lastCheckedAt: checkedAt,
          originalPrice: product.price,
          partnerUrl: product.partnerUrl,
          slug: getProductSlug(product),
          title: product.title,
          priceHistories: {
            create: {
              checkedAt,
              discountRate: 0,
              originalPrice: product.price,
              price: product.price,
            },
          },
        },
      });

      await syncCatalogObservation(
        tx,
        created.id,
        product,
        category.id,
        checkedAt,
        product.price,
        assessment,
        requestId,
      );

      if (collectionRuleId) {
        await tx.collectionRuleProduct.create({
          data: {
            collectionRuleId,
            lastSeenAt: checkedAt,
            productId: created.id,
          },
        });
      }

      return { product: created, status: "created" as const };
    }

    const assessment = await assessPriceObservation(
      tx,
      existing.id,
      product.price,
    );
    const referencePrice = assessment.isAnomaly
      ? existing.originalPrice
      : Math.max(existing.originalPrice, product.price);
    const discountRate = calculateDiscountRate(referencePrice, product.price);
    const priceChanged =
      !assessment.isAnomaly && existing.currentPrice !== product.price;
    const { end: historyDayEnd, start: historyDayStart } =
      getUtcDayRange(checkedAt);
    const hasLegacyHistoryToday = await tx.productPriceHistory.findFirst({
      select: { id: true },
      where: {
        checkedAt: { gte: historyDayStart, lt: historyDayEnd },
        productId: existing.id,
      },
    });
    const shouldWriteLegacyHistory =
      !assessment.isAnomaly && (priceChanged || !hasLegacyHistoryToday);
    const updated = await tx.product.update({
      data: {
        categoryId: category.id,
        coupangItemId: product.itemId,
        coupangProductId: product.productId,
        coupangUrl: getCoupangUrl(product),
        coupangVendorItemId: product.vendorItemId,
        currentPrice: assessment.isAnomaly
          ? existing.currentPrice
          : product.price,
        discountRate: assessment.isAnomaly
          ? existing.discountRate
          : discountRate,
        imageUrl: product.imageUrl,
        isActive: true,
        lastCheckedAt: checkedAt,
        originalPrice: referencePrice,
        partnerUrl: product.partnerUrl,
        title: product.title,
        priceHistories: !shouldWriteLegacyHistory
          ? undefined
          : {
              create: {
                checkedAt,
                discountRate,
                originalPrice: referencePrice,
                price: product.price,
              },
            },
      },
      where: { id: existing.id },
    });

    await syncCatalogObservation(
      tx,
      updated.id,
      product,
      category.id,
      checkedAt,
      referencePrice,
      assessment,
      requestId,
    );

    if (collectionRuleId) {
      await tx.collectionRuleProduct.upsert({
        create: {
          collectionRuleId,
          lastSeenAt: checkedAt,
          productId: updated.id,
        },
        update: {
          lastSeenAt: checkedAt,
        },
        where: {
          collectionRuleId_productId: {
            collectionRuleId,
            productId: updated.id,
          },
        },
      });
    }

    return {
      product: updated,
      status: priceChanged ? ("changed" as const) : ("unchanged" as const),
    };
  });
}

export async function collectCoupangKeyword(
  keyword: string,
  limit = MAX_COUPANG_COLLECTION_LIMIT,
  collectionRuleId?: string,
): Promise<CollectionSummary> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL이 설정되지 않아 상품을 저장할 수 없습니다.");
  }

  const normalizedKeyword = keyword.trim().replace(/\s+/g, " ");

  if (!normalizedKeyword) {
    throw new Error("수집 키워드가 필요합니다.");
  }

  const result = await searchCoupangProducts(normalizedKeyword, limit);
  const candidates = result.products.map(normalizeCoupangProduct);
  const checkedAt = new Date();
  const statuses = await Promise.all(
    candidates.map((product) =>
      persistProduct(product, checkedAt, collectionRuleId, result.requestId),
    ),
  );

  return {
    changed: statuses.filter(({ status }) => status === "changed").length,
    created: statuses.filter(({ status }) => status === "created").length,
    keyword: normalizedKeyword,
    received: candidates.length,
    unchanged: statuses.filter(({ status }) => status === "unchanged").length,
  };
}

function getEnvironmentCollectionRules() {
  return (process.env.COUPANG_COLLECTION_KEYWORDS ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((keyword) => ({
      id: undefined,
      keyword,
      limit: MAX_COUPANG_COLLECTION_LIMIT,
      minDiscountRate: 10,
    }));
}

export async function getConfiguredCollectionRules() {
  if (isDatabaseConfigured()) {
    let rules = await prisma.collectionRule.findMany({
      orderBy: { createdAt: "asc" },
      where: { isActive: true },
    });

    if (rules.length === 0) {
      const environmentRules = getEnvironmentCollectionRules();

      if (environmentRules.length > 0) {
        await prisma.collectionRule.createMany({
          data: environmentRules.map(
            ({ keyword, limit, minDiscountRate }) => ({
              keyword,
              limit,
              minDiscountRate,
            }),
          ),
          skipDuplicates: true,
        });
        rules = await prisma.collectionRule.findMany({
          orderBy: { createdAt: "asc" },
          where: { isActive: true },
        });
      }
    }

    if (rules.length > 0) {
      return rules.map(({ id, keyword, limit, minDiscountRate }) => ({
        id,
        keyword,
        limit,
        minDiscountRate,
      }));
    }
  }

  return getEnvironmentCollectionRules();
}

export async function collectConfiguredCoupangKeywords() {
  const rules = await getConfiguredCollectionRules();

  if (rules.length === 0) {
    throw new Error("활성화된 수집 규칙이 없습니다.");
  }

  const summaries = [];

  for (const rule of rules) {
    const summary = rule.id
      ? await collectCoupangKeyword(rule.keyword, rule.limit, rule.id)
      : await collectCoupangKeyword(rule.keyword, rule.limit);

    summaries.push({
      ...summary,
      minDiscountRate: rule.minDiscountRate,
    });
  }

  return summaries;
}
