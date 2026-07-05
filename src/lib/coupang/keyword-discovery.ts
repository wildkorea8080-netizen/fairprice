import "server-only";

import {
  getCoupangBestCategoryProducts,
  getCoupangGoldboxProducts,
} from "@/lib/coupang/client";
import { coupangBestCategories } from "@/lib/coupang/discovery";
import type { CoupangProduct } from "@/lib/coupang/types";
import {
  ensureKeywordSource,
  normalizeKeyword,
  upsertKeywordCandidate,
} from "@/lib/keyword-candidates";
import { isDatabaseConfigured } from "@/lib/prisma";

type CoupangKeywordDiscoveryMode = "all" | "category" | "goldbox";

const STOPWORDS = new Set([
  "and",
  "for",
  "new",
  "the",
  "with",
  "개",
  "개입",
  "공식",
  "국내",
  "단품",
  "무료",
  "무료배송",
  "본품",
  "세트",
  "신상",
  "정품",
  "증정",
  "쿠팡",
  "특가",
  "할인",
]);

function normalizeTitle(title: string) {
  return title
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[{}<>]/g, " ")
    .replace(/[,+/|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulToken(token: string) {
  const cleaned = token.toLocaleLowerCase("ko-KR");

  if (STOPWORDS.has(cleaned)) {
    return false;
  }

  if (/^\d+$/.test(cleaned)) {
    return false;
  }

  if (/^\d+(개|개입|g|kg|l|ml|매|팩|p|입|장)$/i.test(cleaned)) {
    return false;
  }

  return cleaned.length >= 2;
}

function extractKeywordsFromProduct(product: CoupangProduct) {
  const keywords = new Set<string>();
  const title = normalizeTitle(product.productName);
  const tokens = title
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter(isUsefulToken);

  if (product.keyword && normalizeKeyword(product.keyword)) {
    keywords.add(product.keyword);
  }

  if (product.categoryName && normalizeKeyword(product.categoryName)) {
    keywords.add(product.categoryName);
  }

  if (tokens.length > 0) {
    keywords.add(tokens[0]);
  }

  for (const size of [2, 3]) {
    if (tokens.length >= size) {
      keywords.add(tokens.slice(0, size).join(" "));
    }
  }

  return [...keywords]
    .map((keyword) => keyword.trim().replace(/\s+/g, " "))
    .filter((keyword) => {
      const normalized = normalizeKeyword(keyword);
      return normalized.length >= 2 && normalized.length <= 40;
    })
    .slice(0, 5);
}

function scoreKeyword(product: CoupangProduct, index: number, mode: string) {
  const rank = Math.max(product.rank || index + 1, 1);
  const sourceScore = mode === "goldbox" ? 85 : 70;
  const rankScore = Math.max(20 - rank, 0);
  const shippingScore =
    (product.isRocket ? 5 : 0) + (product.isFreeShipping ? 3 : 0);

  return Math.min(sourceScore + rankScore + shippingScore, 100);
}

async function collectProducts(mode: CoupangKeywordDiscoveryMode, categoryId: number) {
  const products: Array<{ mode: "category" | "goldbox"; product: CoupangProduct }> =
    [];

  if (mode === "all" || mode === "goldbox") {
    const result = await getCoupangGoldboxProducts();
    products.push(
      ...result.products.map((product) => ({
        mode: "goldbox" as const,
        product,
      })),
    );
  }

  if (mode === "category") {
    const result = await getCoupangBestCategoryProducts(categoryId, 10);
    products.push(
      ...result.products.map((product) => ({
        mode: "category" as const,
        product,
      })),
    );
  }

  if (mode === "all") {
    for (const category of coupangBestCategories.slice(0, 5)) {
      const result = await getCoupangBestCategoryProducts(category.id, 10);
      products.push(
        ...result.products.map((product) => ({
          mode: "category" as const,
          product,
        })),
      );
    }
  }

  return products;
}

export async function discoverKeywordCandidatesFromCoupang({
  categoryId = 1014,
  mode = "all",
}: {
  categoryId?: number;
  mode?: CoupangKeywordDiscoveryMode;
}) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for Coupang keyword discovery.");
  }

  const source = await ensureKeywordSource(
    "COUPANG_DISCOVERY",
    "Coupang popular products",
    100,
  );
  const productEntries = await collectProducts(mode, categoryId);
  const seen = new Set<string>();
  let createdOrUpdated = 0;

  for (const [index, entry] of productEntries.entries()) {
    const keywords = extractKeywordsFromProduct(entry.product);
    const score = scoreKeyword(entry.product, index, entry.mode);

    for (const keyword of keywords) {
      const normalized = normalizeKeyword(keyword);

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      await upsertKeywordCandidate({
        keyword,
        note: `${entry.mode === "goldbox" ? "골드박스" : "카테고리 베스트"} 상품명에서 추출`,
        score,
        sourceId: source.id,
        sourceKey: `${entry.mode}:${entry.product.productId}:${normalized}`,
        sourceType: "COUPANG_DISCOVERY",
      });
      createdOrUpdated += 1;
    }
  }

  return {
    candidates: createdOrUpdated,
    products: productEntries.length,
  };
}
