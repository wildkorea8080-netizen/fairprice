import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addFavoriteProduct,
  addProductPriceAlert,
} from "@/app/alerts/actions";
import { getProductBySlug } from "@/data/catalog";
import { describePriceGap } from "@/lib/price-gap";
import { getVapidPublicKey } from "@/lib/push-config";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import { PriceChangeTimeline } from "@/components/price-change-timeline";
import { ProductCard } from "@/components/product-card";
import { getAppUrl } from "@/lib/app-config";
import { areProductTitlesComparable } from "@/lib/catalog/title-similarity";
import {
  formatKoreanPrice,
  getDealProductBySlug,
  getRelatedDealProducts,
  type DealProduct,
} from "@/lib/deal-products";
import { getProductOutboundPath } from "@/lib/outbound-links";
import { getProductSeoEligibility } from "@/lib/seo/product-indexability";
import {
  createBreadcrumbJsonLd,
  stringifyJsonLd,
} from "@/lib/seo-jsonld";
import { getKeywordPath, getProductSeoKeywords } from "@/lib/seo-keywords";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    status?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  "database-required": "가격 알림을 저장하려면 PostgreSQL 연결이 필요합니다.",
  "favorite-added": "관심 상품으로 등록했습니다.",
  "product-alert-added": "상품 가격 알림을 등록했습니다.",
  "product-alert-invalid": "목표가 또는 최소 할인율 중 하나를 입력해 주세요.",
  "product-alert-missing": "알림을 등록할 상품을 찾지 못했습니다.",
};

export const dynamic = "force-dynamic";

function getProductSeoDescription(
  product: DealProduct | NonNullable<ReturnType<typeof getProductBySlug>>,
) {
  const savings = Math.max(product.originalPrice - product.price, 0);
  const parts = [
    product.brand,
    product.category.name,
    formatKoreanPrice(product.price),
    `${product.discountRate}% 할인`,
  ];

  if (savings > 0) {
    parts.push(`${formatKoreanPrice(savings)} 절약`);
  }

  return `${product.title} 특가 정보입니다. ${parts.filter(Boolean).join(" · ")}. 페어프라이스에서 가격 변동과 쿠팡 파트너스 링크를 확인하세요.`;
}

function getProductSeoImage(
  product: DealProduct | NonNullable<ReturnType<typeof getProductBySlug>>,
) {
  if ("imageUrl" in product && product.imageUrl) {
    return product.imageUrl;
  }

  return undefined;
}

function getUnitPriceSummary(product: DealProduct) {
  if (!product.unitInfo || product.unitInfo.quantity <= 0) return null;

  const basis = ["g", "ml"].includes(product.unitInfo.label) ? 100 : 1;
  const unitPrice = (product.price / product.unitInfo.quantity) * basis;
  const formattedUnitPrice = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: unitPrice < 10 ? 1 : 0,
  }).format(unitPrice);
  const formattedQuantity = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 3,
  }).format(product.unitInfo.quantity);

  return {
    detail: `총 ${formattedQuantity}${product.unitInfo.label}${product.unitInfo.packCount > 1 ? ` · ${product.unitInfo.packCount}개 묶음` : ""}`,
    price: `${basis}${product.unitInfo.label}당 ${formattedUnitPrice}원`,
  };
}

function getComparableUnitPrice(product: DealProduct) {
  if (!product.unitInfo || product.unitInfo.quantity <= 0) return null;

  const basis = ["g", "ml"].includes(product.unitInfo.label) ? 100 : 1;

  return {
    basis,
    label: product.unitInfo.label,
    value: (product.price / product.unitInfo.quantity) * basis,
  };
}

function getProductJsonLd(
  product: DealProduct | NonNullable<ReturnType<typeof getProductBySlug>>,
) {
  const appUrl = getAppUrl();
  const canonicalUrl = `${appUrl}/products/${product.slug}`;
  const offerUrl = `${appUrl}${getProductOutboundPath(
    product.slug,
    "product-jsonld",
  )}`;
  const image = getProductSeoImage(product);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    category: product.category.name,
    description: product.description,
    image: image ? [image] : undefined,
    name: product.title,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      price: product.price,
      priceCurrency: "KRW",
      seller: {
        "@type": "Organization",
        name: "Coupang",
      },
      url: offerUrl,
    },
    url: canonicalUrl,
  };
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const databaseProduct = await getDealProductBySlug(slug);
  const product = databaseProduct ?? getProductBySlug(slug);

  if (!product) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: "상품을 찾을 수 없습니다",
    };
  }

  const appUrl = getAppUrl();
  const canonicalUrl = `${appUrl}/products/${product.slug}`;
  const description = getProductSeoDescription(product);
  const image = getProductSeoImage(product);
  const title = `${product.title} ${product.discountRate}% 할인`;
  const seoEligibility = databaseProduct
    ? getProductSeoEligibility({
        imageUrl: databaseProduct.imageUrl,
        lastCheckedAt: databaseProduct.lastCheckedAt,
        observedSamples: databaseProduct.dealInsight.observedSamples,
        price: databaseProduct.price,
        source: databaseProduct.source,
        title: databaseProduct.title,
      })
    : { eligible: false };

  return {
    alternates: {
      canonical: canonicalUrl,
    },
    description,
    openGraph: {
      description,
      images: image
        ? [
            {
              alt: product.title,
              url: image,
            },
          ]
        : undefined,
      locale: "ko_KR",
      siteName: "페어프라이스",
      title,
      type: "website",
      url: canonicalUrl,
    },
    robots: {
      follow: true,
      googleBot: {
        follow: true,
        index: seoEligibility.eligible,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
      index: seoEligibility.eligible,
    },
    title,
    twitter: {
      card: image ? "summary_large_image" : "summary",
      description,
      images: image ? [image] : undefined,
      title,
    },
  };
}

function formatCheckedAt(product: DealProduct) {
  if (!product.lastCheckedAt) {
    return "확인 대기";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(product.lastCheckedAt);
}

function confidenceLabel(confidence: DealProduct["dealInsight"]["confidence"]) {
  if (confidence === "high") {
    return "높음";
  }

  if (confidence === "medium") {
    return "보통";
  }

  return "낮음";
}

// Titles state the conclusion outright. "지금 구매를 고려할 만해요" leaves the
// reader to decide what that means; the gap sentence underneath carries the
// evidence in won.
const verdictCopy = {
  average: { eyebrow: "평균 가격대", title: "평균 가격입니다", body: "목표가 알림을 걸어두고 조금 더 지켜보세요.", tone: "border-sky-200 bg-sky-50 text-sky-950" },
  collecting: { eyebrow: "가격 수집 중", title: "아직 판단하기 이릅니다", body: "가격 기록이 더 쌓이면 평균가와 구매 타이밍을 정확하게 알려드릴게요.", tone: "border-slate-200 bg-slate-100 text-slate-950" },
  good: { eyebrow: "좋은 가격", title: "지금 사도 괜찮습니다", body: "관측 최고가와 평균가보다 낮은 구간에 들어왔습니다.", tone: "border-emerald-200 bg-emerald-50 text-emerald-950" },
  lowest: { eyebrow: "관측 최저가", title: "지금이 가장 쌉니다", body: "추적 이후 가장 낮은 구간입니다. 재고와 최종 결제 가격을 확인해 보세요.", tone: "border-rose-200 bg-rose-50 text-rose-950" },
  wait: { eyebrow: "고점 주의", title: "지금은 비싼 편입니다", body: "목표가 알림을 걸어두고 가격이 내려올 때 받아보세요.", tone: "border-amber-200 bg-amber-50 text-amber-950" },
} as const;

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const databaseProduct = await getDealProductBySlug(slug);
  const product = databaseProduct ?? getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = databaseProduct
    ? await getRelatedDealProducts(databaseProduct, 8)
    : [];
  const currentUnitPrice = databaseProduct
    ? getComparableUnitPrice(databaseProduct)
    : null;
  const unitComparisonProducts = currentUnitPrice && databaseProduct
    ? [databaseProduct, ...relatedProducts]
        .filter((candidate) => candidate.unitInfo?.label === currentUnitPrice.label)
        .filter(
          (candidate) =>
            candidate.slug === databaseProduct.slug ||
            areProductTitlesComparable(databaseProduct.title, candidate.title),
        )
        .map((candidate) => ({
          product: candidate,
          unitPrice: getComparableUnitPrice(candidate),
        }))
        .filter(
          (entry): entry is { product: DealProduct; unitPrice: NonNullable<ReturnType<typeof getComparableUnitPrice>> } =>
            entry.unitPrice !== null,
        )
        .sort(
          (a, b) =>
            a.unitPrice.value - b.unitPrice.value ||
            b.product.dealInsight.dealScore - a.product.dealInsight.dealScore,
        )
        .slice(0, 5)
    : [];

  const imageUrl = databaseProduct?.imageUrl;
  const dealInsight = databaseProduct?.dealInsight;
  const unitPriceSummary = databaseProduct
    ? getUnitPriceSummary(databaseProduct)
    : null;
  const verdict = dealInsight ? verdictCopy[dealInsight.verdict] : verdictCopy.collecting;
  const suggestedTargetPrice = Math.max(Math.floor(product.price * 0.95), 1);
  // Null unless VAPID is configured, which hides the button rather than
  // offering one that fails when pressed.
  const vapidPublicKey = getVapidPublicKey();
  const statusMessage = status ? statusMessages[status] : "";
  const jsonLd = getProductJsonLd(product);
  const appUrl = getAppUrl();
  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: "페어프라이스", url: appUrl },
    { name: product.category.name, url: `${appUrl}/categories/${product.category.slug}` },
    { name: product.title, url: `${appUrl}/products/${product.slug}` },
  ]);
  const seoKeywords = getProductSeoKeywords({
    brand: product.brand,
    categoryName: product.category.name,
  });

  return (
    <main className="flex-1 bg-[#f7f8fa] pb-24 text-slate-950 lg:pb-0">
      <script
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLd(jsonLd),
        }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="현재 위치">
          <Link href="/">홈</Link><span>/</span>
          <Link href={`/categories/${product.category.slug}`}>{product.category.name}</Link><span>/</span>
          <span className="max-w-64 truncate text-slate-800">{product.title}</span>
        </nav>
      </div>

      <section className="mx-auto grid w-full max-w-7xl items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
        <div className="relative aspect-square self-start overflow-hidden border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${product.title} 상품 이미지`}
              className="h-full w-full object-contain p-5 sm:p-7"
              src={imageUrl}
            />
          ) : null}
          <span className="absolute left-4 top-4 bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">가격 추적 상품</span>
        </div>

        <div className="border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {statusMessage ? (
            <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              {statusMessage}
            </div>
          ) : null}

          <Link
            className="text-sm font-bold text-emerald-700 hover:text-emerald-800"
            href={`/categories/${product.category.slug}`}
          >
            {product.category.name}
          </Link>
          <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{product.title}</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">{product.brand}</p>

          {seoKeywords.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {seoKeywords.map((keyword) => (
                <Link
                  className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                  href={`/keywords/${getKeywordPath(keyword)}`}
                  key={keyword}
                >
                  #{keyword} 특가
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2 border-y border-slate-200 py-5">
            <div>
              <p className="text-3xl font-black sm:text-4xl">{formatKoreanPrice(product.price)}</p>
              {unitPriceSummary ? (
                <p className="mt-2 text-sm font-bold text-emerald-700">
                  {unitPriceSummary.price}
                  <span className="ml-2 font-medium text-slate-500">{unitPriceSummary.detail}</span>
                </p>
              ) : null}
            </div>
            {product.discountRate > 0 ? <p className="pb-1 text-xl font-black text-rose-600">최고가 대비 ↓{product.discountRate}%</p> : null}
          </div>

          {databaseProduct && dealInsight ? (
            <div className={`mt-5 border p-5 ${verdict.tone}`}>
              <p className="text-xs font-black uppercase">{verdict.eyebrow} · 신뢰도 {confidenceLabel(dealInsight.confidence)}</p>
              <h2 className="mt-2 text-xl font-black">{verdict.title}</h2>
              {dealInsight.verdict === "collecting" ? null : (
                <ul className="mt-3 space-y-1 text-sm font-bold">
                  <li>{describePriceGap(product.price, dealInsight.lowestObservedPrice, "관측 최저가").text}</li>
                  <li>{describePriceGap(product.price, dealInsight.averageObservedPrice, "관측 평균가").text}</li>
                </ul>
              )}
              <p className="mt-3 text-sm leading-6 opacity-80">{verdict.body}</p>
              <p className="mt-3 text-xs font-semibold opacity-70">가격 {dealInsight.observedSamples}회 · {dealInsight.trackingDays}일 추적 · 마지막 확인 {formatCheckedAt(databaseProduct)}</p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <form action={addFavoriteProduct}>
              <input name="slug" type="hidden" value={product.slug} />
              <input name="next" type="hidden" value={`/products/${product.slug}`} />
              <button
                className="w-full rounded-md border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                type="submit"
              >
                관심 상품 등록
              </button>
            </form>
            <a
              className="rounded-md bg-emerald-600 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-700"
              href={getProductOutboundPath(product.slug, "product-detail")}
              rel="sponsored noopener noreferrer"
              target="_blank"
            >
              쿠팡에서 보기
            </a>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            쿠팡에서 보기 링크는 쿠팡 파트너스 제휴 링크입니다. 구매 시
            페어프라이스가 일정액의 수수료를 제공받을 수 있으며, 상품 가격과
            재고는 쿠팡 판매 페이지 기준으로 최종 확인됩니다.
          </p>

          <section className="mt-6 border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-lg font-bold">가격 알림 등록</h2>
            <p className="mt-1 text-sm text-slate-500">
              목표가 이하 또는 지정 할인율 이상이 되면 알림 대기열에 등록합니다.
            </p>
            <form action={addProductPriceAlert} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input name="slug" type="hidden" value={product.slug} />
              <input name="next" type="hidden" value={`/products/${product.slug}`} />
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">목표가</span>
                <input
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  defaultValue={suggestedTargetPrice}
                  min="1"
                  name="maxPrice"
                  step="100"
                  type="number"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">최소 할인율</span>
                <input
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  defaultValue={Math.max(product.discountRate, 10)}
                  max="100"
                  min="1"
                  name="minDiscountRate"
                  type="number"
                />
              </label>
              <button
                className="self-end rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                type="submit"
              >
                알림 등록
              </button>
            </form>

            {vapidPublicKey ? (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <p className="mb-3 text-sm leading-6 text-slate-600">
                  회원가입 없이 이 상품의 가격 알림을 받을 수 있습니다.
                  브라우저 알림은 언제든 끌 수 있습니다.
                </p>
                <PushSubscribeButton
                  maxPrice={suggestedTargetPrice}
                  productSlug={product.slug}
                  vapidPublicKey={vapidPublicKey}
                />
              </div>
            ) : null}
          </section>
        </div>
      </section>

      {databaseProduct && dealInsight ? (
        <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black text-emerald-700">PRICE HISTORY</p>
                <h2 className="mt-2 text-2xl font-black">가격 변동 그래프</h2>
              </div>
              <p className="text-sm text-slate-500">30분마다 자동 확인 · 최근 {dealInsight.observedSamples}회 관측</p>
            </div>
            {/* 현재가·역대 최저가·차액은 차트 상단이 이미 보여준다. 여기서는
                차트에 없는 값만 다룬다. */}
            <div className="mt-6">
              <PriceHistoryChart points={databaseProduct.priceHistory.map((point) => ({ checkedAt: point.checkedAt.toISOString(), price: point.price }))} />
            </div>
            <div className="mt-6 grid grid-cols-3 border-l border-t border-slate-200">
              {[
                ["관측 평균가", formatKoreanPrice(dealInsight.averageObservedPrice)],
                ["관측 최고가", formatKoreanPrice(dealInsight.observedHighPrice)],
                ["가격대 위치", `하위 ${dealInsight.pricePercentile}%`],
              ].map(([label, value]) => (
                <div className="border-b border-r border-slate-200 p-4" key={label}>
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                  <p className="mt-2 text-base font-black sm:text-lg">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">최저·평균·최고가는 페어프라이스가 수집한 기간을 기준으로 합니다. 판매자가 표기한 정가가 아니라 실제로 관측한 가격입니다.</p>
            <PriceChangeTimeline points={databaseProduct.priceHistory.map((point) => ({ checkedAt: point.checkedAt.toISOString(), price: point.price }))} />
            <details className="mt-5 border-t border-slate-200 pt-5">
              <summary className="cursor-pointer text-sm font-bold text-slate-700">가격 이력 표로 보기</summary>
              <div className="mt-4 max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">확인 시각</th><th className="p-3 text-right">가격</th></tr></thead>
                  <tbody>{databaseProduct.priceHistory.map((point, index) => <tr className="border-b border-slate-100" key={`${point.checkedAt.toISOString()}-${index}`}><td className="p-3">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(point.checkedAt)}</td><td className="p-3 text-right font-bold">{formatKoreanPrice(point.price)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          </div>
        </section>
      ) : null}

      {unitComparisonProducts.length > 1 ? (
        <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black text-emerald-700">UNIT PRICE</p>
                <h2 className="mt-2 text-2xl font-black">실구매 단위가격 비교</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  핵심 상품어와 단위가 같은 상품을 실제 구성 수량 기준으로 비교합니다.
                </p>
              </div>
              <p className="text-sm font-bold text-slate-600">
                낮은 단위가격 순
              </p>
            </div>

            <div className="mt-6 overflow-x-auto border border-slate-200">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs text-slate-500">
                  <tr>
                    <th className="p-3">상품</th>
                    <th className="p-3 text-right">판매가</th>
                    <th className="p-3 text-right">총수량</th>
                    <th className="p-3 text-right">단위가격</th>
                    <th className="p-3 text-right">특가점수</th>
                  </tr>
                </thead>
                <tbody>
                  {unitComparisonProducts.map(({ product: candidate, unitPrice }, index) => {
                    const isCurrent = candidate.slug === product.slug;
                    const quantity = new Intl.NumberFormat("ko-KR", {
                      maximumFractionDigits: 3,
                    }).format(candidate.unitInfo?.quantity ?? 0);
                    const formattedUnitPrice = new Intl.NumberFormat("ko-KR", {
                      maximumFractionDigits: unitPrice.value < 10 ? 1 : 0,
                    }).format(unitPrice.value);

                    return (
                      <tr
                        className={`border-t border-slate-200 ${isCurrent ? "bg-emerald-50" : "bg-white"}`}
                        key={candidate.slug}
                      >
                        <td className="p-3">
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <Link className="font-bold text-slate-900 hover:text-emerald-700" href={`/products/${candidate.slug}`}>
                                {candidate.title}
                              </Link>
                              {isCurrent ? <p className="mt-1 text-xs font-bold text-emerald-700">현재 상품</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold">{formatKoreanPrice(candidate.price)}</td>
                        <td className="p-3 text-right text-slate-600">{quantity}{candidate.unitInfo?.label}</td>
                        <td className="p-3 text-right font-black text-emerald-700">
                          {unitPrice.basis}{unitPrice.label}당 {formattedUnitPrice}원
                        </td>
                        <td className="p-3 text-right font-bold">{candidate.dealInsight.dealScore}점</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              상품명에서 명확하게 확인된 용량과 묶음 수량만 사용합니다. 옵션과 실제 구성은 쿠팡 판매 페이지에서 최종 확인해 주세요.
            </p>
          </div>
        </section>
      ) : null}

      {relatedProducts.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><p className="text-xs font-black text-emerald-700">SMART PICKS</p><h2 className="mt-2 text-2xl font-black">비슷한 상품도 비교해 보세요</h2><p className="mt-2 text-sm text-slate-500">같은 카테고리, 브랜드, 가격대와 현재 특가 점수를 함께 비교했습니다.</p></div>
            <Link className="text-sm font-bold text-emerald-700" href={`/categories/${product.category.slug}`}>전체 보기</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{relatedProducts.map((related) => <ProductCard key={related.slug} product={related} />)}</div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_auto] gap-2 border-t border-slate-200 bg-white p-3 shadow-2xl lg:hidden">
        <div><p className="text-xs text-slate-500">현재가</p><p className="font-black">{formatKoreanPrice(product.price)}</p></div>
        <a className="flex items-center bg-emerald-600 px-6 text-sm font-bold text-white" href={getProductOutboundPath(product.slug, "product-mobile-sticky")} rel="sponsored noopener noreferrer" target="_blank">쿠팡에서 보기</a>
      </div>
    </main>
  );
}
