import Link from "next/link";
import { createClickKeywordCandidates } from "@/app/admin/clicks/actions";
import {
  getClickAnalyticsOverview,
  type ClickAnalyticsPeriod,
  type ClickUserFilter,
} from "@/lib/admin-clicks";
import { formatKoreanPrice } from "@/lib/deal-products";

type AdminClicksPageProps = {
  searchParams: Promise<{
    candidates?: string;
    period?: string;
    products?: string;
    q?: string;
    status?: string;
    user?: string;
  }>;
};

type ClickAnalyticsOverview = NonNullable<
  Awaited<ReturnType<typeof getClickAnalyticsOverview>>
>;

const PERIOD_FILTERS = [
  { label: "24시간", value: "1" },
  { label: "7일", value: "7" },
  { label: "30일", value: "30" },
  { label: "전체", value: "all" },
] satisfies Array<{
  label: string;
  value: ClickAnalyticsPeriod;
}>;

const USER_FILTERS = [
  { label: "전체 사용자", value: "all" },
  { label: "로그인 클릭", value: "authenticated" },
  { label: "익명 클릭", value: "anonymous" },
] satisfies Array<{
  label: string;
  value: ClickUserFilter;
}>;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizePeriod(value?: string): ClickAnalyticsPeriod {
  if (value === "1" || value === "7" || value === "30" || value === "all") {
    return value;
  }

  return "7";
}

function normalizeUserFilter(value?: string): ClickUserFilter {
  if (value === "authenticated" || value === "anonymous") {
    return value;
  }

  return "all";
}

function normalizeQuery(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function clicksHref({
  period,
  query = "",
  userFilter = "all",
}: {
  period: ClickAnalyticsPeriod;
  query?: string;
  userFilter?: ClickUserFilter;
}) {
  const params = new URLSearchParams();

  params.set("period", period);

  if (userFilter !== "all") {
    params.set("user", userFilter);
  }

  if (query) {
    params.set("q", query);
  }

  return `/admin/clicks?${params.toString()}`;
}

function getPeriodLabel(period: ClickAnalyticsPeriod) {
  return PERIOD_FILTERS.find((filter) => filter.value === period)?.label ?? "7일";
}

function getUserFilterLabel(userFilter: ClickUserFilter) {
  return (
    USER_FILTERS.find((filter) => filter.value === userFilter)?.label ??
    "전체 사용자"
  );
}

function getSourcePageLabel(sourcePage?: string | null) {
  if (sourcePage === "notification-email") {
    return "이메일 알림";
  }

  if (sourcePage === "notification-message") {
    return "알림 메시지";
  }

  if (sourcePage === "product-card") {
    return "상품 카드";
  }

  if (sourcePage === "product-jsonld") {
    return "구조화 데이터";
  }

  if (sourcePage === "product-detail" || sourcePage === "product") {
    return "상품 상세";
  }

  return "출처 미상";
}

function getStatusTone(status?: string) {
  if (!status) {
    return "";
  }

  return status.includes("required")
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function getStatusMessage({
  candidates,
  products,
  status,
}: {
  candidates: number;
  products: number;
  status?: string;
}) {
  if (status === "database-required") {
    return "PostgreSQL 연결이 필요합니다.";
  }

  if (status === "click-keywords-created") {
    return `클릭 상위 상품 ${products}개에서 키워드 후보 ${candidates}개를 생성했습니다.`;
  }

  return "";
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function renderSearchSummary(overview: ClickAnalyticsOverview) {
  const periodLabel =
    overview.period === "all" ? "전체 기간" : `최근 ${getPeriodLabel(overview.period)}`;

  if (overview.query) {
    return `${periodLabel} · ${getUserFilterLabel(
      overview.userFilter,
    )}에서 "${overview.query}" 검색 결과 ${overview.filteredClicks}건`;
  }

  return `${periodLabel} · ${getUserFilterLabel(overview.userFilter)} 클릭 ${
    overview.filteredClicks
  }건`;
}

export default async function AdminClicksPage({
  searchParams,
}: AdminClicksPageProps) {
  const params = await searchParams;
  const period = normalizePeriod(params.period);
  const query = normalizeQuery(params.q);
  const userFilter = normalizeUserFilter(params.user);
  const statusMessage = getStatusMessage({
    candidates: Number(params.candidates) || 0,
    products: Number(params.products) || 0,
    status: params.status,
  });
  const overview = await getClickAnalyticsOverview({
    period,
    query,
    userFilter,
  });

  if (!overview) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
        PostgreSQL 연결 후 클릭 분석을 확인할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-emerald-700">Affiliate clicks</p>
        <h2 className="mt-1 text-2xl font-bold">제휴 클릭 분석</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          상품 상세에서 쿠팡 파트너스 링크로 이동한 클릭을 집계합니다. 어떤
          상품이 관심을 받는지 확인하고 수집/추천 우선순위를 조정할 수 있습니다.
        </p>
      </section>

      {statusMessage ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-bold ${getStatusTone(
            params.status,
          )}`}
        >
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="필터 결과" value={`${overview.filteredClicks}회`} />
        <MetricCard
          label="로그인 클릭"
          value={`${overview.filteredAuthenticatedClicks}회`}
        />
        <MetricCard
          label="익명 클릭"
          value={`${overview.filteredAnonymousClicks}회`}
        />
        <MetricCard label="전체 클릭" value={`${overview.totalClicks}회`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard label="최근 7일" value={`${overview.clicks7Days}회`} />
        <MetricCard label="최근 24시간" value={`${overview.clicks24Hours}회`} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">분석 필터</h2>
            <p className="mt-1 text-sm text-slate-500">
              {renderSearchSummary(overview)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_FILTERS.map((filter) => {
              const isActive = filter.value === period;

              return (
                <Link
                  className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  href={clicksHref({
                    period: filter.value,
                    query,
                    userFilter,
                  })}
                  key={filter.value}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {USER_FILTERS.map((filter) => {
            const isActive = filter.value === userFilter;

            return (
              <Link
                className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
                href={clicksHref({
                  period,
                  query,
                  userFilter: filter.value,
                })}
                key={filter.value}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
        <form action="/admin/clicks" className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input name="period" type="hidden" value={period} />
          {userFilter !== "all" ? (
            <input name="user" type="hidden" value={userFilter} />
          ) : null}
          <input
            className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            defaultValue={query}
            name="q"
            placeholder="상품명, 카테고리, 이메일, 유입 위치 검색"
            type="search"
          />
          <button
            className="rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            type="submit"
          >
            검색
          </button>
          {query ? (
            <Link
              className="rounded-md border border-slate-300 px-5 py-3 text-center text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              href={clicksHref({ period, userFilter })}
            >
              초기화
            </Link>
          ) : null}
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">클릭 기반 키워드 후보</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              클릭 상위 상품의 브랜드, 카테고리, 상품명 토큰을 키워드 후보로
              저장합니다. 후보는 키워드 관리 화면에서 검토 후 수집 규칙으로
              승인할 수 있습니다.
            </p>
          </div>
          <Link
            className="rounded-md border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href="/admin/keywords"
          >
            키워드 후보 보기
          </Link>
        </div>
        <form
          action={createClickKeywordCandidates}
          className="mt-5 grid gap-3 md:grid-cols-[160px_160px_auto]"
        >
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">기간</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm"
              defaultValue={period === "all" ? "30" : period}
              name="period"
            >
              <option value="1">24시간</option>
              <option value="7">7일</option>
              <option value="30">30일</option>
              <option value="all">전체</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">상품 수</span>
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-sm"
              defaultValue="10"
              max="30"
              min="1"
              name="limit"
              type="number"
            />
          </label>
          <div className="flex items-end">
            <button
              className="h-11 w-full rounded-md bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
              type="submit"
            >
              후보 생성
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold">클릭 상위 상품</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {overview.topProducts.length > 0 ? (
            overview.topProducts.map(({ clicks, product, productId }) => (
              <div
                className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
                key={productId}
              >
                <div>
                  {product ? (
                    <Link
                      className="font-bold text-slate-950 hover:text-emerald-700"
                      href={`/products/${product.slug}`}
                    >
                      {product.title}
                    </Link>
                  ) : (
                    <p className="font-bold text-slate-950">삭제된 상품</p>
                  )}
                  <p className="mt-1 text-sm text-slate-500">
                    {product?.category.name ?? productId}
                  </p>
                </div>
                <p className="text-sm font-bold">
                  {product ? formatKoreanPrice(product.currentPrice) : "-"}
                </p>
                <span className="w-fit rounded-md bg-emerald-50 px-2 py-1 text-sm font-bold text-emerald-700">
                  {product ? `${product.discountRate}% 할인` : "-"}
                </span>
                <span className="w-fit rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-700">
                  {clicks}회
                </span>
              </div>
            ))
          ) : (
            <EmptyState>
              조건에 맞는 클릭 상위 상품이 없습니다.
            </EmptyState>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold">최근 클릭</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {overview.latestClicks.length > 0 ? (
              overview.latestClicks.map((click) => (
                <div className="px-6 py-4" key={click.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      className="font-bold text-slate-950 hover:text-emerald-700"
                      href={`/products/${click.product.slug}`}
                    >
                      {click.product.title}
                    </Link>
                    <span className="text-sm text-slate-500">
                      {formatDate(click.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {click.product.category.name} ·{" "}
                    {getSourcePageLabel(click.sourcePage)}
                    {" · "}
                    {click.user ? click.user.email : "익명 방문자"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    {formatKoreanPrice(click.product.currentPrice)} ·{" "}
                    {click.product.discountRate}% 할인
                  </p>
                </div>
              ))
            ) : (
              <EmptyState>
                조건에 맞는 최근 클릭이 없습니다.
              </EmptyState>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">유입 위치</h2>
          <div className="mt-4 grid gap-3">
            {overview.sourceCounts.length > 0 ? (
              overview.sourceCounts.map((source) => (
                <div
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                  key={source.source}
                >
                  <span className="font-semibold text-slate-700">
                    {getSourcePageLabel(source.source)}
                  </span>
                  <span className="font-bold text-slate-950">
                    {source.count}회
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                표시할 유입 위치가 없습니다.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
