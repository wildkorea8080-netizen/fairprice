import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getAppUrl } from "@/lib/app-config";
import { formatKoreanPrice, getDealProducts } from "@/lib/deal-products";
import { getPublicCategories } from "@/lib/public-categories";
import {
  createProductItemListJsonLd,
  createWebSiteJsonLd,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";

const categoryMarks = ["01", "02", "03", "04", "05", "06", "07", "08"];

export default async function Home() {
  const [featuredProducts, categories] = await Promise.all([
    getDealProducts({ limit: 12 }),
    getPublicCategories(),
  ]);
  const appUrl = getAppUrl();
  const databaseProductCount = featuredProducts.filter(
    (product) => product.source === "database",
  ).length;
  const highestDiscount = Math.max(0, ...featuredProducts.map((product) => product.discountRate));
  const lowestPriceCount = featuredProducts.filter(
    (product) => product.dealInsight.isLowestObserved,
  ).length;
  const tickerProducts = [...featuredProducts.slice(0, 6), ...featuredProducts.slice(0, 6)];
  const websiteJsonLd = createWebSiteJsonLd({
    description:
      "쿠팡 상품 가격을 추적하고 할인율, 카테고리, 관심 키워드별 특가 알림을 제공하는 페어프라이스입니다.",
    name: "페어프라이스",
    url: appUrl,
  });
  const itemListJsonLd = createProductItemListJsonLd({ products: featuredProducts, url: appUrl });

  return (
    <main className="flex-1 bg-[#f7f8fa] text-slate-950">
      <script dangerouslySetInnerHTML={{ __html: stringifyJsonLd(websiteJsonLd) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: stringifyJsonLd(itemListJsonLd) }} type="application/ld+json" />

      <section className="overflow-hidden border-b border-slate-200 bg-white">
        <div className="mx-auto grid min-h-[520px] w-full max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-16">
          <div className="relative z-10">
            <div className="mb-5 inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
              <span className="signal-dot" aria-hidden="true" />
              가격 추적 시스템 가동 중
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.12] sm:text-5xl lg:text-6xl">
              지금 이 가격,
              <br />
              <span className="text-emerald-600">정말 싼 걸까요?</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              쿠팡 가격 이력을 비교해 구매 타이밍을 보여드립니다. 상품명이나 관심 키워드로 바로 확인해 보세요.
            </p>
            <form action="/deals" className="mt-7 flex max-w-2xl gap-2">
              <label className="sr-only" htmlFor="home-product-search">상품 검색</label>
              <input
                className="h-14 min-w-0 flex-1 border border-slate-300 bg-white px-4 text-base outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                id="home-product-search"
                name="q"
                placeholder="상품명 또는 키워드를 입력하세요"
                type="search"
              />
              <button className="h-14 shrink-0 bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-emerald-600" type="submit">
                가격 확인
              </button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="font-semibold text-slate-400">인기 검색</span>
              {categories.slice(0, 4).map((category) => (
                <Link className="font-bold text-slate-600 transition hover:text-emerald-700" href={`/categories/${category.slug}`} key={category.slug}>
                  {category.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative min-h-[380px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[18px_18px_0_#d1fae5] sm:p-7">
            <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <div>
                <p className="text-xs font-bold text-emerald-300">LIVE PRICE SIGNAL</p>
                <p className="mt-1 text-xl font-bold">오늘의 가격 브리핑</p>
              </div>
              <span className="border border-white/20 px-3 py-1 text-xs text-slate-300">실시간</span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                ["추적 상품", `${databaseProductCount || featuredProducts.length}개`],
                ["관측 최저가", `${lowestPriceCount}개`],
                ["최대 하락", `${highestDiscount}%`],
              ].map(([label, value]) => (
                <div className="border border-white/15 bg-white/5 p-3" key={label}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-2 text-xl font-black sm:text-2xl">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              {featuredProducts.slice(0, 3).map((product, index) => (
                <Link className="group grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-white/10 pb-3" href={`/products/${product.slug}`} key={product.slug}>
                  <span className="font-mono text-xs text-slate-500">0{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold group-hover:text-emerald-300">{product.title}</span>
                    <span className="mt-1 block text-xs text-slate-400">{product.dealInsight.badge} · {product.dealInsight.dealScore}점</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-black text-emerald-300">{formatKoreanPrice(product.price)}</span>
                    <span className="text-xs font-bold text-rose-300">↓ {product.discountRate}%</span>
                  </span>
                </Link>
              ))}
            </div>
            <Link className="mt-6 flex h-11 items-center justify-center border border-white/25 text-sm font-bold transition hover:border-emerald-400 hover:bg-emerald-400 hover:text-slate-950" href="/deals">
              전체 특가 탐색
            </Link>
          </div>
        </div>
      </section>

      <section className="ticker-shell border-b border-slate-200 bg-emerald-600 py-3 text-white" aria-label="실시간 특가">
        <div className="ticker-track">
          {tickerProducts.map((product, index) => (
            <Link className="flex shrink-0 items-center gap-3 px-6 text-sm" href={`/products/${product.slug}`} key={`${product.slug}-${index}`}>
              <span className="font-black">↓{product.discountRate}%</span>
              <span className="max-w-56 truncate font-semibold">{product.title}</span>
              <span className="text-emerald-100">{formatKoreanPrice(product.price)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">SHOP BY CATEGORY</p>
              <h2 className="mt-2 text-2xl font-black">카테고리별 가격 탐색</h2>
            </div>
            <Link className="text-sm font-bold text-slate-600 hover:text-emerald-700" href="/categories">전체 카테고리</Link>
          </div>
          <div className="grid grid-cols-2 border-l border-t border-slate-200 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, 6).map((category, index) => (
              <Link className="group min-h-28 border-b border-r border-slate-200 p-4 transition hover:bg-emerald-50" href={`/categories/${category.slug}`} key={category.slug}>
                <span className="font-mono text-xs text-slate-400">{categoryMarks[index]}</span>
                <span className="mt-6 block font-bold text-slate-800 group-hover:text-emerald-800">{category.name}</span>
                <span className="mt-1 block text-xs text-slate-400">특가 확인 →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-emerald-700">PRICE DROP NOW</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">지금 확인된 특가</h2>
            <p className="mt-2 text-sm text-slate-500">가격 이력, 하락폭, 데이터 신뢰도를 함께 계산한 순위입니다.</p>
          </div>
          <Link className="text-sm font-bold text-emerald-700 hover:text-emerald-900" href="/deals">전체 보기 →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.slice(0, 8).map((product) => <ProductCard key={product.slug} product={product} />)}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold text-emerald-700">WATCH & ALERT</p>
            <h2 className="mt-2 text-3xl font-black">원하는 가격이 오면, 그때 알려드릴게요.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">관심 상품이나 키워드를 등록하고 목표 가격과 할인 조건을 설정하세요.</p>
          </div>
          <Link className="flex h-12 items-center justify-center bg-slate-950 px-7 text-sm font-bold text-white transition hover:bg-emerald-600" href="/alerts">
            내 알림 만들기
          </Link>
        </div>
      </section>
    </main>
  );
}
