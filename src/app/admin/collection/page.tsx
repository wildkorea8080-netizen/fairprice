import Link from "next/link";
import {
  addCollectionRule,
  collectAndTrackProducts,
  removeCollectionRule,
  toggleCollectionRule,
} from "@/app/admin/collection/actions";
import { formatPrice } from "@/data/catalog";
import { getCollectionRules } from "@/lib/collection-rules";
import {
  areCoupangCredentialsConfigured,
  searchCoupangProducts,
} from "@/lib/coupang/client";
import {
  normalizeCoupangProduct,
  type ImportedProductCandidate,
} from "@/lib/coupang/normalize";
import { isDatabaseConfigured } from "@/lib/prisma";
import { getTrackingOverview } from "@/lib/tracked-products";

type CollectionPageProps = {
  searchParams: Promise<{
    changed?: string;
    created?: string;
    keyword?: string;
    limit?: string;
    status?: string;
    unchanged?: string;
  }>;
};

function getNotice(params: Awaited<CollectionPageProps["searchParams"]>) {
  if (params.status === "keyword-required") {
    return {
      message: "수집할 키워드를 입력해 주세요.",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (params.status === "database-required") {
    return {
      message:
        "검색은 가능하지만 가격 이력 저장에는 PostgreSQL DATABASE_URL이 필요합니다.",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (params.status === "tracking-failed") {
    return {
      message:
        "상품 저장 중 오류가 발생했습니다. 데이터베이스 연결과 마이그레이션 상태를 확인해 주세요.",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (params.status === "tracked") {
    return {
      message: `신규 ${Number(params.created) || 0}개, 가격 변경 ${
        Number(params.changed) || 0
      }개, 가격 유지 ${Number(params.unchanged) || 0}개를 처리했습니다.`,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (params.status === "rule-invalid") {
    return {
      message: "수집 규칙에 사용할 키워드를 입력해 주세요.",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (params.status?.startsWith("rule-")) {
    return {
      message: "수집 규칙을 업데이트했습니다.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  return null;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default async function CollectionPage({
  searchParams,
}: CollectionPageProps) {
  const params = await searchParams;
  const keyword = params.keyword?.trim() ?? "";
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 10);
  const credentialsConfigured = areCoupangCredentialsConfigured();
  const databaseConfigured = isDatabaseConfigured();
  const collectionRules = await getCollectionRules();
  const trackingOverview = await getTrackingOverview();
  const notice = getNotice(params);
  let errorMessage = "";
  let products: ImportedProductCandidate[] = [];

  if (keyword && credentialsConfigured) {
    try {
      const result = await searchCoupangProducts(keyword, limit);
      products = result.products.map(normalizeCoupangProduct);
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "쿠팡 상품 검색 중 알 수 없는 오류가 발생했습니다.";
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">Coupang Partners API</p>
            <h2 className="mt-1 text-2xl font-bold">자동 상품 수집</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              쿠팡 파트너스 API로 키워드 검색 결과를 가져오고, 선택한 키워드를
              가격 추적 규칙으로 등록합니다. 저장된 상품은 가격 이력과 특가
              후보 계산에 사용됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-md px-3 py-2 text-sm font-bold ${
                credentialsConfigured
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              API {credentialsConfigured ? "설정됨" : "미설정"}
            </span>
            <span
              className={`rounded-md px-3 py-2 text-sm font-bold ${
                databaseConfigured
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              가격 DB {databaseConfigured ? "연결됨" : "연결 필요"}
            </span>
          </div>
        </div>

        <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">수집 키워드</span>
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              defaultValue={keyword}
              name="keyword"
              placeholder="예: 물티슈"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">가져올 개수</span>
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              defaultValue={limit}
              max="10"
              min="1"
              name="limit"
              type="number"
            />
          </label>
          <button
            className="self-end rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            type="submit"
          >
            쿠팡 상품 검색
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {notice ? (
          <p className={`mt-5 rounded-md border px-4 py-3 text-sm font-semibold ${notice.tone}`}>
            {notice.message}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold">자동 수집 규칙</h2>
          <p className="mt-1 text-sm text-slate-500">
            활성 키워드의 상위 상품을 주기적으로 수집하고, 관측 최고가 대비
            기준 이상 하락한 상품을 특가 후보로 사용합니다.
          </p>
        </div>

        <form
          action={addCollectionRule}
          className="grid gap-3 border-b border-slate-200 bg-slate-50 px-6 py-5 md:grid-cols-[1fr_130px_150px_auto]"
        >
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">키워드</span>
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
              name="keyword"
              placeholder="예: 로봇청소기"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">수집 개수</span>
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
              defaultValue="10"
              max="10"
              min="1"
              name="limit"
              type="number"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">최소 하락률</span>
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
              defaultValue="10"
              max="100"
              min="0"
              name="minDiscountRate"
              type="number"
            />
          </label>
          <button
            className="self-end rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
            type="submit"
          >
            규칙 저장
          </button>
        </form>

        <div className="divide-y divide-slate-200">
          {collectionRules.length > 0 ? (
            collectionRules.map((rule) => (
              <div
                className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_auto] md:items-center"
                key={rule.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-950">{rule.keyword}</strong>
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        rule.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {rule.isActive ? "활성" : "중지"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    상위 {rule.limit}개 수집 · 관측 최고가 대비{" "}
                    {rule.minDiscountRate}% 이상 하락 시 특가 후보
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    href={`/admin/collection?keyword=${encodeURIComponent(rule.keyword)}&limit=${rule.limit}`}
                  >
                    검색 확인
                  </Link>
                  <form action={toggleCollectionRule}>
                    <input name="id" type="hidden" value={rule.id} />
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      type="submit"
                    >
                      {rule.isActive ? "중지" : "활성화"}
                    </button>
                  </form>
                  <form action={removeCollectionRule}>
                    <input name="id" type="hidden" value={rule.id} />
                    <button
                      className="rounded-md border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
                      type="submit"
                    >
                      삭제
                    </button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="px-6 py-8 text-sm text-slate-500">
              아직 등록된 수집 규칙이 없습니다. 추적할 키워드를 추가해 주세요.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold">가격 추적 현황</h2>
          <p className="mt-1 text-sm text-slate-500">
            규칙으로 발견한 상품, 실제 가격 변화, 특가 후보 충족 여부를
            확인합니다.
          </p>
        </div>

        {trackingOverview ? (
          <>
            <div className="grid gap-3 border-b border-slate-200 p-6 sm:grid-cols-3">
              <StatCard label="추적 상품" value={`${trackingOverview.trackedProducts}개`} />
              <StatCard label="가격 변화" value={`${trackingOverview.priceChanges}회`} />
              <StatCard label="특가 후보" value={`${trackingOverview.dealCandidates}개`} />
            </div>
            <div className="divide-y divide-slate-200">
              {trackingOverview.latestProducts.length > 0 ? (
                trackingOverview.latestProducts.map((product) => (
                  <div
                    className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_auto] md:items-center"
                    key={product.id}
                  >
                    <div>
                      <p className="font-bold text-slate-950">{product.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {product.categoryName} · 규칙{" "}
                        {product.matchedRules.join(", ") || "미연결"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 md:justify-end">
                      <strong>{formatPrice(product.currentPrice)}</strong>
                      <span
                        className={`rounded-md px-2 py-1 text-sm font-bold ${
                          product.discountRate > 0
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {product.discountRate}% 하락
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-6 py-8 text-sm text-slate-500">
                  아직 저장된 추적 상품이 없습니다.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="px-6 py-8">
            <p className="font-bold text-slate-700">PostgreSQL 연결 대기 중</p>
            <p className="mt-2 text-sm text-slate-500">
              DATABASE_URL과 마이그레이션이 준비되면 추적 상품, 가격 변화,
              특가 후보 통계가 이곳에 표시됩니다.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold">검색 결과</h2>
            <p className="mt-1 text-sm text-slate-500">
              쿠팡에서 가져온 최신 검색 결과입니다. 아직 가격 이력이 없으므로
              할인 판단은 저장 후 추적하면서 계산됩니다.
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
            {products.length}개
          </span>
        </div>

        {products.length > 0 ? (
          <form
            action={collectAndTrackProducts}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4"
          >
            <input name="keyword" type="hidden" value={keyword} />
            <input name="limit" type="hidden" value={limit} />
            <p className="text-sm text-slate-600">
              현재 키워드로 상품을 다시 조회하고 가격 이력을 저장합니다.
            </p>
            <button
              className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!databaseConfigured}
              type="submit"
            >
              {products.length}개 가격 추적 시작
            </button>
          </form>
        ) : null}

        {products.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {products.map((product) => (
              <article
                className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center"
                key={product.externalProductKey}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      {product.categoryName}
                    </span>
                    {product.isRocket ? (
                      <span className="rounded bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700">
                        로켓배송
                      </span>
                    ) : null}
                    {product.isFreeShipping ? (
                      <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                        무료배송
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-bold text-slate-950">{product.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    쿠팡 상품 ID {product.productId}
                  </p>
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <strong className="text-lg text-slate-950">
                    {formatPrice(product.price)}
                  </strong>
                  <Link
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    href={product.partnerUrl}
                    rel="sponsored noopener noreferrer"
                    target="_blank"
                  >
                    파트너스 링크 확인
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            {keyword
              ? "표시할 상품이 없습니다."
              : "수집 키워드를 입력해 쿠팡 상품 검색을 시작하세요."}
          </div>
        )}
      </section>
    </div>
  );
}
