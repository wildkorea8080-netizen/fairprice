import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { getAppUrl } from "@/lib/app-config";
import { getDealProducts } from "@/lib/deal-products";
import { getKeywordSeoEligibility } from "@/lib/seo/keyword-indexability";
import {
  createBreadcrumbJsonLd,
  createProductItemListJsonLd,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";
import {
  getKeywordPath,
  getSeoKeywordPage,
} from "@/lib/seo-keywords";

type KeywordPageProps = {
  params: Promise<{
    keyword: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: KeywordPageProps): Promise<Metadata> {
  const { keyword: pathKeyword } = await params;
  const keywordPage = await getSeoKeywordPage(pathKeyword);

  if (!keywordPage) {
    return {
      title: "키워드를 찾을 수 없습니다",
      robots: {
        follow: false,
        index: false,
      },
    };
  }

  const appUrl = getAppUrl();
  const url = `${appUrl}/keywords/${getKeywordPath(keywordPage.keyword)}`;
  const title = `${keywordPage.keyword} 쿠팡 특가`;
  const description = `${keywordPage.keyword} 관련 쿠팡 할인 상품, 가격 추적 정보, 특가 알림 대상을 페어프라이스에서 확인하세요.`;

  // The page stays reachable and keeps working; it just asks not to be indexed
  // until it has products to show. Collection re-qualifies it on its own.
  const eligible = getKeywordSeoEligibility(keywordPage).eligible;

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
    robots: {
      follow: true,
      index: eligible,
    },
    title,
  };
}

export default async function KeywordPage({ params }: KeywordPageProps) {
  const { keyword: pathKeyword } = await params;
  const keywordPage = await getSeoKeywordPage(pathKeyword);

  if (!keywordPage) {
    notFound();
  }

  const products = await getDealProducts({
    limit: 80,
    searchQuery: keywordPage.keyword,
  });
  const databaseProductCount = products.filter(
    (product) => product.source === "database",
  ).length;
  const appUrl = getAppUrl();
  const pageUrl = `${appUrl}/keywords/${getKeywordPath(keywordPage.keyword)}`;
  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: "페어프라이스", url: appUrl },
    { name: `${keywordPage.keyword} 특가`, url: pageUrl },
  ]);
  const itemListJsonLd = createProductItemListJsonLd({
    products,
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
            Keyword deals
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            {keywordPage.keyword} 쿠팡 특가
          </h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            {keywordPage.keyword} 관련 상품의 가격 변동과 할인 정보를 모아
            보여줍니다. 가격 추적 대상이 늘어날수록 이 페이지의 상품도 함께
            갱신됩니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              href={`/deals?q=${encodeURIComponent(keywordPage.keyword)}`}
            >
              특가 목록에서 검색
            </Link>
            <Link
              className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
              href="/alerts"
            >
              키워드 알림 등록
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">상품 {products.length}개</h2>
            <p className="mt-1 text-sm text-slate-500">
              {databaseProductCount > 0
                ? `DB 추적 상품 ${databaseProductCount}개 기준`
                : "가격 추적 데이터 수집 중"}
            </p>
          </div>
          <p className="text-sm text-slate-500">특가 점수순</p>
        </div>

        {products.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            아직 이 키워드에 맞는 상품이 없습니다. 자동 수집이 진행되면 상품이
            표시됩니다.
          </div>
        )}
      </section>
    </main>
  );
}
