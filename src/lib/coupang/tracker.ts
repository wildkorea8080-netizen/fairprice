import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { searchCoupangProducts } from "@/lib/coupang/client";
import {
  normalizeCoupangProduct,
  type ImportedProductCandidate,
} from "@/lib/coupang/normalize";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

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

async function persistProduct(
  product: ImportedProductCandidate,
  checkedAt: Date,
  collectionRuleId?: string,
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

    const referencePrice = Math.max(existing.originalPrice, product.price);
    const discountRate = calculateDiscountRate(referencePrice, product.price);
    const priceChanged = existing.currentPrice !== product.price;
    const updated = await tx.product.update({
      data: {
        categoryId: category.id,
        coupangItemId: product.itemId,
        coupangProductId: product.productId,
        coupangUrl: getCoupangUrl(product),
        coupangVendorItemId: product.vendorItemId,
        currentPrice: product.price,
        discountRate,
        imageUrl: product.imageUrl,
        isActive: true,
        lastCheckedAt: checkedAt,
        originalPrice: referencePrice,
        partnerUrl: product.partnerUrl,
        title: product.title,
        priceHistories: {
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
      persistProduct(product, checkedAt, collectionRuleId),
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
