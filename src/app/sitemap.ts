import type { MetadataRoute } from "next";
import { categories, products } from "@/data/catalog";
import { getAppUrl } from "@/lib/app-config";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getKeywordPath, getSeoKeywordPages } from "@/lib/seo-keywords";

export const dynamic = "force-dynamic";

async function getDatabaseCategoryUrls(appUrl: string) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const dbCategories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        slug: true,
        updatedAt: true,
      },
      take: 1000,
      where: { isActive: true },
    });

    return dbCategories.map((category) => ({
      changeFrequency: "daily" as const,
      lastModified: category.updatedAt,
      priority: 0.7,
      url: `${appUrl}/categories/${category.slug}`,
    }));
  } catch {
    return [];
  }
}

async function getDatabaseProductUrls(appUrl: string) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const dbProducts = await prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        imageUrl: true,
        lastCheckedAt: true,
        slug: true,
        updatedAt: true,
      },
      take: 5000,
      where: {
        coupangExternalId: { not: null },
        isActive: true,
      },
    });

    return dbProducts.map((product) => ({
      changeFrequency: "hourly" as const,
      images: product.imageUrl ? [product.imageUrl] : undefined,
      lastModified: product.lastCheckedAt ?? product.updatedAt,
      priority: 0.8,
      url: `${appUrl}/products/${product.slug}`,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getAppUrl();
  const publicRoutes = [
    { path: "", priority: 1 },
    { path: "/deals", priority: 0.8 },
    { path: "/categories", priority: 0.8 },
    { path: "/affiliate-disclosure", priority: 0.35 },
    { path: "/terms", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
  ];
  const databaseCategoryUrls = await getDatabaseCategoryUrls(appUrl);
  const databaseProductUrls = await getDatabaseProductUrls(appUrl);
  const keywordPages = await getSeoKeywordPages();
  const databaseCategorySlugs = new Set(
    databaseCategoryUrls.map((item) => item.url.split("/categories/")[1]),
  );
  const databaseSlugs = new Set(
    databaseProductUrls.map((item) => item.url.split("/products/")[1]),
  );

  return [
    ...publicRoutes.map((route) => ({
      changeFrequency: route.path ? ("monthly" as const) : ("daily" as const),
      priority: route.priority,
      url: `${appUrl}${route.path}`,
    })),
    ...categories.map((category) => ({
      changeFrequency: "daily" as const,
      priority: 0.7,
      url: `${appUrl}/categories/${category.slug}`,
    })).filter(
      (item) => !databaseCategorySlugs.has(item.url.split("/categories/")[1]),
    ),
    ...databaseCategoryUrls,
    ...keywordPages.map((keywordPage) => ({
      changeFrequency: "daily" as const,
      lastModified: keywordPage.updatedAt,
      priority: keywordPage.productCount > 0 ? 0.75 : 0.55,
      url: `${appUrl}/keywords/${getKeywordPath(keywordPage.keyword)}`,
    })),
    ...products.map((product) => ({
      changeFrequency: "hourly" as const,
      priority: 0.8,
      url: `${appUrl}/products/${product.slug}`,
    })).filter((item) => !databaseSlugs.has(item.url.split("/products/")[1])),
    ...databaseProductUrls,
  ];
}
