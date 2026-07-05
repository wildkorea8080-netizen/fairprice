import Link from "next/link";
import { formatPrice } from "@/data/catalog";
import {
  getCoupangBestCategoryProducts,
  getCoupangGoldboxProducts,
} from "@/lib/coupang/client";
import {
  coupangBestCategories,
  normalizeDiscoveredProducts,
} from "@/lib/coupang/discovery";

type DiscoveryPageProps = {
  searchParams: Promise<{
    categoryId?: string;
    limit?: string;
    source?: string;
  }>;
};

function getSourceLabel(source: "category" | "goldbox") {
  return source === "goldbox" ? "골드박스" : "카테고리 베스트";
}

export default async function DiscoveryPage({
  searchParams,
}: DiscoveryPageProps) {
  const params = await searchParams;
  const source = params.source === "category" ? "category" : "goldbox";
  const categoryId = Number(params.categoryId) || 1014;
  const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 50);
  let errorMessage = "";
  let products: ReturnType<typeof normalizeDiscoveredProducts> = [];

  try {
    const result =
      source === "goldbox"
        ? await getCoupangGoldboxProducts()
        : await getCoupangBestCategoryProducts(categoryId, limit);

    products = normalizeDiscoveredProducts(result.products, source);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "상품 발견 API 호출 중 오류가 발생했습니다.";
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-emerald-700">Product discovery</p>
        <h2 className="mt-1 text-2xl font-bold">인기 상품 발견</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          쿠팡 골드박스와 카테고리 베스트에서 수요가 확인된 상품을 찾아
          추적 후보로 검토합니다. 발견 점수는 소스, 순위, 배송 조건을 조합해
          계산합니다.
        </p>

        <form className="mt-6 grid gap-3 md:grid-cols-[160px_1fr_120px_auto]">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">발견 채널</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm"
              defaultValue={source}
              name="source"
            >
              <option value="goldbox">골드박스</option>
              <option value="category">카테고리 베스트</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">카테고리</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
              defaultValue={categoryId}
              disabled={source === "goldbox"}
              name="categoryId"
            >
              {coupangBestCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">상품 수</span>
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-sm"
              defaultValue={limit}
              max="50"
              min="1"
              name="limit"
              type="number"
            />
          </label>
          <button
            className="self-end rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            type="submit"
          >
            후보 조회
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold">{getSourceLabel(source)} 후보</h2>
            <p className="mt-1 text-sm text-slate-500">
              출처, 순위, 로켓배송, 무료배송 조건으로 초기 추적 우선순위를
              계산했습니다.
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
            {products.length}개
          </span>
        </div>

        {products.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {products.map((product) => (
              <article
                className="grid gap-4 px-6 py-5 lg:grid-cols-[80px_1fr_auto] lg:items-center"
                key={product.externalProductKey}
              >
                <div>
                  <p className="text-xs font-bold text-slate-500">발견 점수</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {product.discoveryScore}
                  </p>
                </div>
                <div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                      {getSourceLabel(source)} {product.rank}위
                    </span>
                    {product.isRocket ? (
                      <span className="rounded bg-sky-50 px-2 py-1 text-sky-700">
                        로켓배송
                      </span>
                    ) : null}
                    {product.isFreeShipping ? (
                      <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">
                        무료배송
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-bold text-slate-950">{product.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{product.categoryName}</p>
                </div>
                <div className="flex items-center gap-3 lg:justify-end">
                  <strong className="text-lg">{formatPrice(product.price)}</strong>
                  <Link
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    href={product.partnerUrl}
                    rel="sponsored noopener noreferrer"
                    target="_blank"
                  >
                    상품 확인
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            표시할 발견 후보가 없습니다. 쿠팡 API 설정 또는 선택한 채널을
            확인해 주세요.
          </div>
        )}
      </section>
    </div>
  );
}
