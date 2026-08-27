import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getAppUrl } from "@/lib/app-config";
import {
  createProductDedupeSet,
  selectDiverseProducts,
} from "@/lib/catalog/diverse-products";
import {
  buildDealFeedSections,
  getActiveDealFeed,
  getRecentDealSignals,
} from "@/lib/deal-feed";
import { formatKoreanPrice, getDealProducts } from "@/lib/deal-products";
import { getPublicCategories } from "@/lib/public-categories";
import {
  createProductItemListJsonLd,
  createWebSiteJsonLd,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";

const categoryMarks = ["01", "02", "03", "04", "05", "06", "07", "08"];

export default async function Home() {
  const [featuredProducts, categories, activeDealFeed, recentDealSignals] = await Promise.all([
    getDealProducts({ limit: 60 }),
    getPublicCategories(),
    getActiveDealFeed(40),
    getRecentDealSignals(48),
  ]);
  const visibleDealFeed = activeDealFeed.length > 0 ? activeDealFeed : recentDealSignals;
  const dealFeedSections = buildDealFeedSections(visibleDealFeed);
  const dealSectionProducts = dealFeedSections.flatMap(({ items }) => items.map(({ product }) => product));
  // The grid is the home page now, so it shows a browsable amount rather than
  // a teaser. getDealProducts already fetches sixty; eight of them reached the
  // page.
  const primaryProducts = selectDiverseProducts({
    excludedKeys: createProductDedupeSet(dealSectionProducts),
    limit: 24,
    products: featuredProducts,
  });
  const briefingProducts = selectDiverseProducts({ limit: 3, products: featuredProducts });
  const appUrl = getAppUrl();
  const databaseProductCount = featuredProducts.filter(
    (product) => product.source === "database",
  ).length;
  const highestDiscount = Math.max(0, ...featuredProducts.map((product) => product.discountRate));
  const lowestPriceCount = featuredProducts.filter(
    (product) => product.dealInsight.isLowestObserved,
  ).length;
  const tickerSource = primaryProducts.length > 0 ? primaryProducts : briefingProducts;
  const tickerProducts = [...tickerSource.slice(0, 6), ...tickerSource.slice(0, 6)];
  const websiteJsonLd = createWebSiteJsonLd({
    description:
      "쿠팡 상품 가격을 추적하고 할인율, 카테고리, 관심 키워드별 특가 알림을 제공하는 페어프라이스입니다.",
    name: "페어프라이스",
    url: appUrl,
  });
  const itemListJsonLd = createProductItemListJsonLd({ products: featuredProducts.slice(0, 12), url: appUrl });

  return (
    <main className="flex-1 bg-[#f7f8fa] text-slate-950">
      <script dangerouslySetInnerHTML={{ __html: stringifyJsonLd(websiteJsonLd) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: stringifyJsonLd(itemListJsonLd) }} type="application/ld+json" />

      {/* Deal discovery, not a landing page. The previous hero ran 645px tall
          on a 900px screen, so the deal grid started below the fold and the
          only products visible were three repeats of what the feed shows
          right underneath. DEAL_ENGINE_DIRECTIVE asks the home page to answer
          "오늘 뭐 싸졌지?" first. */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800">
                <span className="signal-dot" aria-hidden="true" />
                가격 추적 시스템 가동 중
              </div>
              <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
                지금 이 가격, <span className="text-emerald-600">정말 싼 걸까요?</span>
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                쿠팡 가격 이력을 비교해 구매 타이밍을 보여드립니다.
              </p>
            </div>

            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {[
                ["추적 상품", `${databaseProductCount || featuredProducts.length}개`],
                ["관측 최저가", `${lowestPriceCount}개`],
                ["최대 하락", `${highestDiscount}%`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-xl font-black">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <form action="/deals" className="mt-5 flex gap-2">
            <label className="sr-only" htmlFor="home-product-search">상품 검색</label>
            <input
              className="h-12 min-w-0 flex-1 border border-slate-300 bg-white px-4 text-base outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              id="home-product-search"
              name="q"
              placeholder="상품명 또는 키워드를 입력하세요"
              type="search"
            />
            <button className="h-12 shrink-0 bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-emerald-600" type="submit">
              가격 확인
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="font-semibold text-slate-400">인기 검색</span>
            {categories.slice(0, 4).map((category) => (
              <Link className="font-bold text-slate-600 transition hover:text-emerald-700" href={`/categories/${category.slug}`} key={category.slug}>
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {dealFeedSections.length > 0 ? (
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
            {dealFeedSections.map((section) => (
              <div key={section.key}>
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-700">DEAL ENGINE SIGNAL</p>
                    <h2 className="mt-2 text-2xl font-black sm:text-3xl">{section.title}</h2>
                    <p className="mt-2 text-sm text-slate-500">{section.description}</p>
                  </div>
                  <Link className="shrink-0 text-sm font-bold text-emerald-700 hover:text-emerald-900" href="/deals">전체 보기 →</Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {section.items.slice(0, 4).map((item) => (
                    <div className="relative" key={`${section.key}-${item.dealId}`}>
                      <span className="absolute right-3 top-3 z-20 bg-emerald-600 px-2 py-1 text-xs font-black text-white shadow-sm">
                        {item.verification === "OBSERVED" ? "검증 중 · " : ""}{item.eventLabel}
                      </span>
                      <ProductCard product={item.product} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ticker-shell border-b border-slate-200 bg-emerald-600 py-3 text-white" aria-label="실시간 특가">
        <div className="ticker-track">
          {tickerProducts.map((product, index) => (
            <Link className="flex shrink-0 items-center gap-3 px-6 text-sm" href={`/products/${product.slug}`} key={`${product.slug}-${index}`}>
              <span className="font-black">{product.discountRate > 0 ? `↓${product.discountRate}%` : product.dealInsight.badge}</span>
              <span className="max-w-56 truncate font-semibold">{product.title}</span>
              <span className="text-emerald-100">{formatKoreanPrice(product.price)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-emerald-700">PRICE DROP NOW</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">구매 타이밍을 확인하세요</h2>
            <p className="mt-2 text-sm text-slate-500">신규 상품은 가격을 수집하고, 이력이 쌓인 상품은 하락폭과 평균가를 함께 판단합니다.</p>
          </div>
          <Link className="text-sm font-bold text-emerald-700 hover:text-emerald-900" href="/deals">전체 보기 →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {primaryProducts.map((product) => <ProductCard key={product.slug} product={product} />)}
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
