import Link from "next/link";
import {
  addProductNote,
  hideProduct,
  restoreProduct,
  toggleFeaturedProduct,
} from "@/app/admin/actions";
import { StatusNotice } from "@/components/admin/status-notice";
import {
  getAdminProductOverview,
  type AdminProductStatusFilter,
} from "@/lib/admin-products";
import { formatKoreanPrice } from "@/lib/deal-products";

type AdminProductsPageProps = {
  searchParams: Promise<{
    status?: string;
    view?: string;
  }>;
};

function normalizeView(value?: string): AdminProductStatusFilter {
  if (value === "hidden" || value === "all") {
    return value;
  }

  return "active";
}

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function viewHref(view: AdminProductStatusFilter) {
  return view === "active" ? "/admin/products" : `/admin/products?view=${view}`;
}

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const params = await searchParams;
  const activeView = normalizeView(params.view);
  const overview = await getAdminProductOverview({ status: activeView });

  return (
    <div>
      <StatusNotice status={params.status} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">상품 관리</h2>
          <p className="mt-1 text-sm text-slate-500">
            쿠팡 API로 수집된 상품을 숨김, 추천, 운영 메모 기준으로 관리합니다.
          </p>
        </div>
        <Link
          className="rounded-md bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-700"
          href="/admin/collection"
        >
          상품 수집하기
        </Link>
      </div>

      {overview ? (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            {[
              ["활성 상품", overview.active],
              ["숨김 상품", overview.hidden],
              ["추천 상품", overview.featured],
            ].map(([label, value]) => (
              <div
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                key={label}
              >
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ["active", "활성"],
              ["hidden", "숨김"],
              ["all", "전체"],
            ].map(([view, label]) => (
              <Link
                className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                  activeView === view
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                href={viewHref(view as AdminProductStatusFilter)}
                key={view}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-500 lg:grid">
              <span>상품</span>
              <span>가격</span>
              <span>할인</span>
              <span>상태</span>
              <span className="text-right">운영 작업</span>
            </div>

            <div className="divide-y divide-slate-200">
              {overview.products.map((product) => {
                const latestNote = product.adminNotes[0];

                return (
                  <div
                    className="grid gap-4 px-4 py-5 lg:grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr_1fr] lg:items-start"
                    key={product.slug}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-950">{product.title}</p>
                        {product.isFeatured ? (
                          <span className="rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                            추천
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {product.category.name} · 마지막 확인{" "}
                        {formatDate(product.lastCheckedAt)}
                      </p>
                      {latestNote ? (
                        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          {latestNote.note}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-sm font-bold">
                        {formatKoreanPrice(product.currentPrice)}
                      </p>
                      <p className="text-xs text-slate-400 line-through">
                        {formatKoreanPrice(product.originalPrice)}
                      </p>
                    </div>

                    <span className="w-fit rounded-md bg-rose-50 px-2 py-1 text-sm font-bold text-rose-700">
                      {product.discountRate}%
                    </span>

                    <span
                      className={`w-fit rounded-md px-2 py-1 text-sm font-bold ${
                        product.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {product.isActive ? "활성" : "숨김"}
                    </span>

                    <div className="grid gap-2 lg:justify-items-end">
                      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                        <Link
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                          href={`/products/${product.slug}`}
                        >
                          보기
                        </Link>
                        <form action={toggleFeaturedProduct}>
                          <input name="slug" type="hidden" value={product.slug} />
                          <input
                            name="nextFeatured"
                            type="hidden"
                            value={String(!product.isFeatured)}
                          />
                          <button
                            className="rounded-md border border-amber-200 px-3 py-2 text-sm font-bold text-amber-700 transition hover:bg-amber-50"
                            type="submit"
                          >
                            {product.isFeatured ? "추천 해제" : "추천"}
                          </button>
                        </form>
                        <form
                          action={product.isActive ? hideProduct : restoreProduct}
                        >
                          <input name="slug" type="hidden" value={product.slug} />
                          <button
                            className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                              product.isActive
                                ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                            type="submit"
                          >
                            {product.isActive ? "숨김" : "복구"}
                          </button>
                        </form>
                      </div>

                      <form action={addProductNote} className="flex w-full gap-2">
                        <input name="slug" type="hidden" value={product.slug} />
                        <input
                          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                          name="note"
                          placeholder="운영 메모"
                        />
                        <button
                          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                          type="submit"
                        >
                          저장
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}

              {overview.products.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  표시할 상품이 없습니다.
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          PostgreSQL 연결 후 수집된 상품을 관리할 수 있습니다.
        </div>
      )}
    </div>
  );
}
