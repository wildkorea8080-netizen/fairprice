import Link from "next/link";
import { DealFilters } from "@/components/deal-filters";
import { ProductCard } from "@/components/product-card";
import { getAppUrl } from "@/lib/app-config";
import { getDealProducts } from "@/lib/deal-products";
import { getPublicCategories } from "@/lib/public-categories";
import {
  createProductItemListJsonLd,
  createWebSiteJsonLd,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";

export default async function Home() {
  const [featuredProducts, categories] = await Promise.all([
    getDealProducts({ limit: 8 }),
    getPublicCategories(),
  ]);
  const appUrl = getAppUrl();
  const databaseProductCount = featuredProducts.filter(
    (product) => product.source === "database",
  ).length;
  const highestDiscount = featuredProducts[0]?.discountRate ?? 0;
  const websiteJsonLd = createWebSiteJsonLd({
    description:
      "쿠팡 상품 가격을 추적하고 할인율, 카테고리, 관심 키워드별 특가 알림을 제공하는 페어프라이스입니다.",
    name: "페어프라이스",
    url: appUrl,
  });
  const itemListJsonLd = createProductItemListJsonLd({
    products: featuredProducts,
    url: appUrl,
  });

  return (
    <main className="flex-1 bg-slate-50 text-slate-950">
      <script
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(websiteJsonLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(itemListJsonLd) }}
        type="application/ld+json"
      />
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Coupang deal monitor
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
              쿠팡 가격을 추적하고 진짜 특가를 먼저 보여드립니다
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              페어프라이스는 쿠팡 파트너스 API로 상품을 수집하고 가격 이력을
              비교해 특가 점수를 계산합니다. 관심 키워드와 가격 조건을 등록하면
              조건에 맞는 상품을 알림 대기열에 담을 수 있습니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                href="/deals"
              >
                특가 보기
              </Link>
              <Link
                className="rounded-md border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                href="/alerts"
              >
                알림 설정
              </Link>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            {[
              ["추적 상품", `${databaseProductCount || featuredProducts.length}개`],
              ["카테고리", `${categories.length}개`],
              ["최고 할인율", `${highestDiscount}%`],
            ].map(([label, value]) => (
              <div
                className="flex items-center justify-between rounded-md bg-white px-4 py-3 shadow-sm"
                key={label}
              >
                <span className="text-sm font-medium text-slate-500">{label}</span>
                <span className="text-xl font-bold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DealFilters categories={categories} />

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              지금 확인된 특가 상품
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              가격 이력과 할인율을 함께 계산한 특가 점수순 목록입니다.
            </p>
          </div>
          <Link
            className="text-sm font-bold text-emerald-700 hover:text-emerald-800"
            href="/deals"
          >
            전체 보기
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}
