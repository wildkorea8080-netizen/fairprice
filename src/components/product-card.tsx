import Link from "next/link";
import { addFavoriteProduct } from "@/app/alerts/actions";
import type { Product } from "@/data/catalog";
import { formatKoreanPrice, type DealProduct } from "@/lib/deal-products";
import { getProductOutboundPath } from "@/lib/outbound-links";
import { getKeywordPath, getProductSeoKeywords } from "@/lib/seo-keywords";

type ProductCardProps = {
  product: Product | DealProduct;
};

function isDealProduct(product: Product | DealProduct): product is DealProduct {
  return "dealInsight" in product;
}

export function ProductCard({ product }: ProductCardProps) {
  const imageUrl = "imageUrl" in product ? product.imageUrl : undefined;
  const dealInsight = isDealProduct(product) ? product.dealInsight : null;
  const primaryReason = dealInsight?.reasons[0];
  const seoKeywords = getProductSeoKeywords({
    brand: product.brand,
    categoryName: product.category.name,
  });

  return (
    <article className="group overflow-hidden border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl">
      <div
        className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden ${product.imageTone}`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${product.title} 상품 이미지`}
            className="h-full w-full object-contain p-5 transition duration-500 group-hover:scale-105"
            loading="lazy"
            src={imageUrl}
          />
        ) : null}
        <Link
          className="absolute left-3 top-3 bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-white"
          href={`/categories/${product.category.slug}`}
        >
          {product.category.name}
        </Link>
        {dealInsight ? (
          <span className="absolute bottom-3 left-3 bg-slate-950/90 px-3 py-2 text-xs font-bold text-white shadow-sm">
            {dealInsight.badge} · {dealInsight.dealScore}점
          </span>
        ) : null}
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-h-12 text-base font-bold leading-6 text-slate-950">
            {product.title}
          </h3>
          <span className="shrink-0 bg-rose-600 px-2 py-1 text-sm font-black text-white">
            ↓{product.discountRate}%
          </span>
        </div>

        <div>
          <p className="text-sm text-slate-400 line-through">
            {formatKoreanPrice(product.originalPrice)}
          </p>
          <p className="text-xl font-bold text-slate-950">
            {formatKoreanPrice(product.price)}
          </p>
          {primaryReason ? (
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              {primaryReason}
            </p>
          ) : null}
        </div>

        {seoKeywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {seoKeywords.map((keyword) => (
              <Link
                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                href={`/keywords/${getKeywordPath(keyword)}`}
                key={keyword}
              >
                #{keyword}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Link
              className="border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              href={`/products/${product.slug}`}
            >
              상세 보기
            </Link>
            <a
              className="bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
              href={getProductOutboundPath(product.slug, "product-card")}
              rel="sponsored noopener noreferrer"
              target="_blank"
            >
              쿠팡 보기
            </a>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            쿠팡 보기 링크는 쿠팡 파트너스 제휴 링크이며, 구매 시 페어프라이스가
            일정액의 수수료를 제공받을 수 있습니다.
          </p>
          <form action={addFavoriteProduct}>
            <input name="slug" type="hidden" value={product.slug} />
            <input name="next" type="hidden" value={`/products/${product.slug}`} />
            <button
              className="w-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              type="submit"
            >
              관심 등록
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
