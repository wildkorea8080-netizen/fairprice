import "server-only";

import {
  categories as sampleCategories,
  getProductsByCategory,
} from "@/data/catalog";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type PublicCategory = {
  description: string;
  name: string;
  productCount: number;
  slug: string;
  source: "database" | "sample";
};

function getSampleCategories() {
  return sampleCategories.map((category) => ({
    ...category,
    productCount: getProductsByCategory(category.slug).length,
    source: "sample" as const,
  }));
}

export async function getPublicCategories(): Promise<PublicCategory[]> {
  if (!isDatabaseConfigured()) {
    return getSampleCategories();
  }

  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            products: {
              where: {
                coupangExternalId: { not: null },
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: { isActive: true },
    });

    if (categories.length === 0) {
      return getSampleCategories();
    }

    return categories.map((category) => ({
      description: `${category.name} 카테고리의 쿠팡 가격 추적 상품입니다.`,
      name: category.name,
      productCount: category._count.products,
      slug: category.slug,
      source: "database" as const,
    }));
  } catch {
    return getSampleCategories();
  }
}
