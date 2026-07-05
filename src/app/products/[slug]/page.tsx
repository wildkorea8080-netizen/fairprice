import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addFavoriteProduct,
  addProductPriceAlert,
} from "@/app/alerts/actions";
import { getProductBySlug } from "@/data/catalog";
import { getAppUrl } from "@/lib/app-config";
import {
  formatKoreanPrice,
  getDealProductBySlug,
  type DealProduct,
} from "@/lib/deal-products";
import { getProductOutboundPath } from "@/lib/outbound-links";
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
        index: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
      index: true,
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

  const savings = Math.max(product.originalPrice - product.price, 0);
  const imageUrl = databaseProduct?.imageUrl;
  const dealInsight = databaseProduct?.dealInsight;
  const suggestedTargetPrice = Math.max(Math.floor(product.price * 0.95), 1);
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
    <main className="flex-1 bg-slate-50 text-slate-950">
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
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div
          className={`relative flex min-h-80 items-center justify-center overflow-hidden rounded-lg ${product.imageTone}`}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${product.title} 상품 이미지`}
              className="max-h-96 w-full object-contain p-8"
              src={imageUrl}
            />
          ) : null}
          <Link
            className="absolute left-4 top-4 rounded-md bg-white/90 px-4 py-3 text-base font-bold text-slate-700 shadow-sm transition hover:bg-white"
            href={`/categories/${product.category.slug}`}
          >
            {product.category.name}
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
          <h1 className="mt-3 text-3xl font-bold leading-tight">{product.title}</h1>
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

          <p className="mt-5 leading-7 text-slate-600">{product.description}</p>

          <div className="mt-8 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                현재가
              </p>
              <p className="mt-1 text-2xl font-bold">
                {formatKoreanPrice(product.price)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                최고가 대비
              </p>
              <p className="mt-1 text-2xl font-bold text-rose-700">
                {product.discountRate}%
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                절약 금액
              </p>
              <p className="mt-1 text-2xl font-bold">
                {formatKoreanPrice(savings)}
              </p>
            </div>
          </div>

          {databaseProduct && dealInsight ? (
            <div className="mt-5 rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-bold text-slate-950">
                    {dealInsight.badge}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    특가 점수 {dealInsight.dealScore}점 · 신뢰도{" "}
                    {confidenceLabel(dealInsight.confidence)} · 마지막 확인{" "}
                    {formatCheckedAt(databaseProduct)}
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>관측 최고가 {formatKoreanPrice(dealInsight.observedHighPrice)}</p>
                  <p>관측 최저가 {formatKoreanPrice(dealInsight.lowestObservedPrice)}</p>
                  {dealInsight.previousPrice ? (
                    <p>
                      직전가 {formatKoreanPrice(dealInsight.previousPrice)} 대비{" "}
                      {dealInsight.previousPriceDropRate}% 하락
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {dealInsight.reasons.map((reason) => (
                  <span
                    className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                    key={reason}
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
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

          <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
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
          </section>
        </div>
      </section>
    </main>
  );
}
