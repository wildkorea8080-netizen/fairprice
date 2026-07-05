import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type SeoKeywordPage = {
  keyword: string;
  productCount: number;
  updatedAt: Date;
};

const fallbackKeywords = [
  "물티슈",
  "캡슐커피",
  "로봇청소기",
  "공기청정기",
  "기저귀",
  "보조배터리",
];

function normalizeKeywordPath(value: string) {
  return decodeURIComponent(value).trim().replace(/\s+/g, " ");
}

export function getKeywordPath(keyword: string) {
  return encodeURIComponent(keyword.trim().replace(/\s+/g, " "));
}

export function getProductSeoKeywords({
  brand,
  categoryName,
}: {
  brand?: string | null;
  categoryName?: string | null;
}) {
  return [brand, categoryName]
    .map((keyword) => keyword?.trim().replace(/\s+/g, " "))
    .filter((keyword): keyword is string => Boolean(keyword))
    .slice(0, 3);
}

export async function getSeoKeywordPages(): Promise<SeoKeywordPage[]> {
  if (!isDatabaseConfigured()) {
    return fallbackKeywords.map((keyword) => ({
      keyword,
      productCount: 0,
      updatedAt: new Date(),
    }));
  }

  try {
    const rules = await prisma.collectionRule.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { keyword: "asc" }],
      take: 500,
      where: { isActive: true },
    });

    return rules.map((rule) => ({
      keyword: rule.keyword,
      productCount: rule._count.products,
      updatedAt: rule.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getSeoKeywordPage(
  pathKeyword: string,
): Promise<SeoKeywordPage | null> {
  const keyword = normalizeKeywordPath(pathKeyword);

  if (!keyword) {
    return null;
  }

  if (!isDatabaseConfigured()) {
    return {
      keyword,
      productCount: 0,
      updatedAt: new Date(),
    };
  }

  try {
    const rule = await prisma.collectionRule.findUnique({
      include: {
        _count: {
          select: { products: true },
        },
      },
      where: { keyword },
    });

    if (!rule || !rule.isActive) {
      return {
        keyword,
        productCount: 0,
        updatedAt: new Date(),
      };
    }

    return {
      keyword: rule.keyword,
      productCount: rule._count.products,
      updatedAt: rule.updatedAt,
    };
  } catch {
    return null;
  }
}
