import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DealFilters } from "@/components/deal-filters";
import { ProductCard } from "@/components/product-card";
import { categories as sampleCategories } from "@/data/catalog";
import { getAppUrl } from "@/lib/app-config";
import { getDealProducts } from "@/lib/deal-products";
import { getPublicCategories } from "@/lib/public-categories";
import {
  createBreadcrumbJsonLd,
  createProductItemListJsonLd,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

async function getCategory(slug: string) {
  const categories = await getPublicCategories();

  return (
    categories.find((item) => item.slug === slug) ??
    sampleCategories.find((item) => item.slug === slug)
  );
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  const appUrl = getAppUrl();

  if (!category) {
    return {
      title: "카테고리를 찾을 수 없습니다",
      robots: {
        follow: false,
        index: false,
      },
    };
  }

  const title = `${category.name} 쿠팡 특가`;
  const description = `${category.name} 카테고리의 쿠팡 할인 상품, 가격 추적 정보, 특가 알림 대상을 확인하세요.`;
  const url = `${appUrl}/categories/${category.slug}`;

  return {
    alternates: {
      canonical: url,
    },
    description,
    openGraph: {
      description,
      locale: "ko_KR",
      siteName: "페어프라이스",
      title,
      type: "website",
      url,
    },
    title,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const categories = await getPublicCategories();
  const category =
    categories.find((item) => item.slug === slug) ??
    sampleCategories.find((item) => item.slug === slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = await getDealProducts({
    categorySlug: category.slug,
    limit: 80,
  });
  const appUrl = getAppUrl();
  const pageUrl = `${appUrl}/categories/${category.slug}`;
  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: "페어프라이스", url: appUrl },
    { name: "카테고리", url: `${appUrl}/categories` },
    { name: category.name, url: pageUrl },
  ]);
  const itemListJsonLd = createProductItemListJsonLd({
    products: categoryProducts,
    url: pageUrl,
  });

  return (
    <main className="flex-1 bg-slate-50 text-slate-950">
      <script
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(itemListJsonLd) }}
        type="application/ld+json"
      />
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Category
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{category.name}</h1>
          <p className="mt-3 max-w-2xl text-slate-600">{category.description}</p>
        </div>
      </section>

      <DealFilters activeCategory={category.slug} categories={categories} />

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">상품 {categoryProducts.length}개</h2>
          <p className="text-sm text-slate-500">특가 점수순</p>
        </div>
        {categoryProducts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categoryProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            이 카테고리에 표시할 상품이 아직 없습니다.
          </div>
        )}
      </section>
    </main>
  );
}
