import type { Metadata } from "next";
import { DealFilters } from "@/components/deal-filters";
import { ProductCard } from "@/components/product-card";
import { getAppUrl } from "@/lib/app-config";
import { getDealProducts } from "@/lib/deal-products";
import { getPublicCategories } from "@/lib/public-categories";
import {
  createBreadcrumbJsonLd,
  createProductItemListJsonLd,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";

type DealsPageProps = {
  searchParams: Promise<{
    discount?: string;
    q?: string;
  }>;
};

export async function generateMetadata({
  searchParams,
}: DealsPageProps): Promise<Metadata> {
  const { discount, q } = await searchParams;
  const appUrl = getAppUrl();
  const query = q?.trim();
  const discountRate = Number(discount) || undefined;
  const titleParts = [
    query ? `${query} 특가` : "쿠팡 특가 상품",
    discountRate ? `${discountRate}% 이상 할인` : undefined,
  ].filter(Boolean);
  const title = titleParts.join(" · ");
  const description = query
    ? `${query} 관련 쿠팡 할인 상품과 가격 추적 정보를 확인하세요.`
    : "쿠팡 가격 추적 상품을 할인율, 키워드, 카테고리별로 모아 보는 페어프라이스 특가 목록입니다.";

  return {
    alternates: {
      canonical: `${appUrl}/deals`,
    },
    description,
    openGraph: {
      description,
      locale: "ko_KR",
      siteName: "페어프라이스",
      title,
      type: "website",
      url: `${appUrl}/deals`,
    },
    title,
  };
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const { discount, q } = await searchParams;
  const activeDiscount = discount ? Number(discount) : undefined;
  const activeQuery = q?.trim() || undefined;
  const [visibleProducts, categories] = await Promise.all([
    getDealProducts({
      minDiscountRate: activeDiscount,
      searchQuery: activeQuery,
    }),
    getPublicCategories(),
  ]);
  const databaseProductCount = visibleProducts.filter(
    (product) => product.source === "database",
  ).length;
  const appUrl = getAppUrl();
  const pageUrl = `${appUrl}/deals`;
  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: "페어프라이스", url: appUrl },
    { name: "특가 상품", url: pageUrl },
  ]);
  const itemListJsonLd = createProductItemListJsonLd({
    products: visibleProducts,
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
            Deals
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            가격 이력 기반 특가
          </h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            관측 최고가 대비 하락률, 직전가 대비 하락률, 관측 최저가 여부를
            함께 계산해 특가 점수가 높은 상품부터 보여줍니다.
          </p>
        </div>
      </section>

      <DealFilters
        activeDiscount={activeDiscount}
        activeQuery={activeQuery}
        categories={categories}
      />

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">상품 {visibleProducts.length}개</h2>
            <p className="mt-1 text-sm text-slate-500">
              {databaseProductCount > 0
                ? `DB 추적 상품 ${databaseProductCount}개 기준`
                : "샘플 상품 기준"}
              {activeQuery ? ` · 검색어 "${activeQuery}"` : ""}
            </p>
          </div>
          <p className="text-sm text-slate-500">특가 점수순</p>
        </div>

        {visibleProducts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            조건에 맞는 특가 상품이 아직 없습니다.
          </div>
        )}
      </section>
    </main>
  );
}
