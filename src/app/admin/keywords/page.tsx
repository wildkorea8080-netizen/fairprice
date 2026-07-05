import {
  type KeywordCandidateStatus,
  type KeywordSourceType,
} from "@prisma/client";
import Link from "next/link";
import {
  addKeywordCandidates,
  approveKeywordCandidate,
  approveTopKeywordCandidates,
  discoverCoupangKeywordCandidates,
  rejectKeywordCandidate,
  restoreKeywordCandidate,
  seedKeywordCandidates,
} from "@/app/admin/keywords/actions";
import { coupangBestCategories } from "@/lib/coupang/discovery";
import { getKeywordCandidateOverview } from "@/lib/keyword-candidates";
import { isDatabaseConfigured } from "@/lib/prisma";

type KeywordsPageProps = {
  searchParams: Promise<{
    count?: string;
    products?: string;
    q?: string;
    source?: string;
    status?: string;
    state?: string;
  }>;
};

const STATUS_FILTERS = [
  { label: "전체", value: undefined },
  { label: "검토 대기", value: "NEW" },
  { label: "승인됨", value: "APPROVED" },
  { label: "제외됨", value: "REJECTED" },
] satisfies Array<{
  label: string;
  value?: KeywordCandidateStatus;
}>;

const SOURCE_FILTERS = [
  { label: "전체 출처", value: undefined },
  { label: "수동", value: "MANUAL" },
  { label: "쿠팡 발견", value: "COUPANG_DISCOVERY" },
  { label: "사용자 활동", value: "USER_ACTIVITY" },
  { label: "AI 확장", value: "AI_EXPANSION" },
  { label: "외부 트렌드", value: "EXTERNAL_TREND" },
] satisfies Array<{
  label: string;
  value?: KeywordSourceType;
}>;

const statusMessages: Record<string, string> = {
  "coupang-keywords-discovered": "쿠팡 인기 상품에서 키워드 후보를 추출했습니다.",
  "coupang-keywords-failed": "쿠팡 인기 상품 키워드 추출 중 오류가 발생했습니다.",
  "database-required": "PostgreSQL 연결이 필요합니다.",
  "keyword-approved": "키워드를 자동 수집 규칙으로 승인했습니다.",
  "keyword-missing": "키워드 후보를 찾을 수 없습니다.",
  "keyword-rejected": "키워드 후보를 제외했습니다.",
  "keyword-required": "키워드를 입력해 주세요.",
  "keyword-restored": "키워드 후보를 다시 검토 상태로 돌렸습니다.",
  "keywords-added": "키워드 후보를 추가했습니다.",
  "keywords-seeded": "초기 인기 키워드 후보를 생성했습니다.",
  "top-keywords-approved": "상위 키워드 후보를 자동 수집 규칙으로 승인했습니다.",
};

function normalizeStatus(value?: string): KeywordCandidateStatus | undefined {
  if (value === "NEW" || value === "APPROVED" || value === "REJECTED") {
    return value;
  }

  return undefined;
}

function normalizeSourceType(value?: string): KeywordSourceType | undefined {
  if (
    value === "MANUAL" ||
    value === "COUPANG_DISCOVERY" ||
    value === "USER_ACTIVITY" ||
    value === "AI_EXPANSION" ||
    value === "EXTERNAL_TREND"
  ) {
    return value;
  }

  return undefined;
}

function normalizeQuery(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function keywordHref({
  query = "",
  sourceType,
  status,
}: {
  query?: string;
  sourceType?: KeywordSourceType;
  status?: KeywordCandidateStatus;
}) {
  const params = new URLSearchParams();

  if (status) {
    params.set("state", status);
  }

  if (sourceType) {
    params.set("source", sourceType);
  }

  if (query) {
    params.set("q", query);
  }

  const search = params.toString();

  return search ? `/admin/keywords?${search}` : "/admin/keywords";
}

function getFilteredSummary({
  filteredTotal,
  query,
}: {
  filteredTotal: number;
  query: string;
}) {
  if (query) {
    return `"${query}" 검색 결과 ${filteredTotal}개`;
  }

  return `필터 결과 ${filteredTotal}개`;
}

function getSourceTypeLabel(sourceType: KeywordSourceType) {
  return (
    SOURCE_FILTERS.find((filter) => filter.value === sourceType)?.label ??
    sourceType
  );
}

function getStatusTone(status?: string) {
  if (!status) {
    return "";
  }

  return status.includes("required") ||
    status.includes("missing") ||
    status.includes("failed")
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function getCandidateStatusLabel(status: KeywordCandidateStatus) {
  if (status === "APPROVED") {
    return "승인됨";
  }

  if (status === "REJECTED") {
    return "제외됨";
  }

  return "검토 대기";
}

function getCandidateStatusTone(status: KeywordCandidateStatus) {
  if (status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "REJECTED") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-700";
}

export default async function AdminKeywordsPage({
  searchParams,
}: KeywordsPageProps) {
  const params = await searchParams;
  const databaseConfigured = isDatabaseConfigured();
  const activeStatus = normalizeStatus(params.state);
  const activeSourceType = normalizeSourceType(params.source);
  const query = normalizeQuery(params.q);
  const overview = await getKeywordCandidateOverview({
    query,
    sourceType: activeSourceType,
    status: activeStatus,
  });
  const statusMessage = params.status ? statusMessages[params.status] : "";
  const count = Number(params.count) || 0;
  const products = Number(params.products) || 0;

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">
              Keyword discovery
            </p>
            <h2 className="mt-1 text-2xl font-bold">인기 키워드 후보</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              쿠팡 상품을 넓게 수집하기 위한 키워드 후보 풀입니다. 승인된
              키워드는 자동 수집 규칙으로 연결되어 가격 추적 대상 상품을
              늘립니다.
            </p>
          </div>
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              databaseConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            키워드 DB {databaseConfigured ? "연결됨" : "연결 필요"}
          </span>
        </div>

        {statusMessage ? (
          <p
            className={`mt-5 rounded-md border px-4 py-3 text-sm font-semibold ${getStatusTone(
              params.status,
            )}`}
          >
            {statusMessage}
            {count > 0 ? ` 후보 ${count}개` : ""}
            {products > 0 ? ` · 상품 ${products}개 분석` : ""}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["전체 후보", overview?.total ?? 0],
          ["검토 대기", overview?.newCount ?? 0],
          ["승인됨", overview?.approvedCount ?? 0],
          ["제외됨", overview?.rejectedCount ?? 0],
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

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">출처별 후보</h2>
            <p className="mt-1 text-sm text-slate-500">
              클릭 기반 후보와 쿠팡 발견 후보를 빠르게 구분해 검토할 수 있습니다.
            </p>
          </div>
          <Link
            className="rounded-md border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href="/admin/clicks"
          >
            클릭 분석 보기
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {overview && overview.sourceTypeCounts.length > 0 ? (
            overview.sourceTypeCounts.map((source) => (
              <Link
                className={`rounded-lg border p-4 transition ${
                  activeSourceType === source.sourceType
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50"
                }`}
                href={keywordHref({
                  query,
                  sourceType: source.sourceType,
                  status: activeStatus,
                })}
                key={source.sourceType}
              >
                <p className="text-sm font-bold text-slate-600">
                  {getSourceTypeLabel(source.sourceType)}
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {source._count._all}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              아직 출처별 후보가 없습니다.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">후보 필터</h2>
            <p className="mt-1 text-sm text-slate-500">
              {getFilteredSummary({
                filteredTotal: overview?.filteredTotal ?? 0,
                query,
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const isActive = filter.value === activeStatus;

              return (
                <Link
                  className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  href={keywordHref({
                    query,
                    sourceType: activeSourceType,
                    status: filter.value,
                  })}
                  key={filter.label}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((filter) => {
            const isActive = filter.value === activeSourceType;

            return (
              <Link
                className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
                href={keywordHref({
                  query,
                  sourceType: filter.value,
                  status: activeStatus,
                })}
                key={filter.label}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
        <form action="/admin/keywords" className="mt-5 flex flex-col gap-3 sm:flex-row">
          {activeStatus ? (
            <input name="state" type="hidden" value={activeStatus} />
          ) : null}
          {activeSourceType ? (
            <input name="source" type="hidden" value={activeSourceType} />
          ) : null}
          <input
            className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            defaultValue={query}
            name="q"
            placeholder="키워드, 메모, 출처명 검색"
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
              href={keywordHref({
                sourceType: activeSourceType,
                status: activeStatus,
              })}
            >
              초기화
            </Link>
          ) : null}
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-6">
          <form
            action={discoverCoupangKeywordCandidates}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-bold">쿠팡 인기 상품에서 추출</h2>
            <p className="mt-2 text-sm text-slate-500">
              골드박스와 카테고리 베스트 상품명을 분석해 브랜드명, 카테고리,
              핵심 상품 키워드를 후보로 저장합니다.
            </p>
            <label className="mt-5 grid gap-2">
              <span className="text-sm font-bold text-slate-700">수집 범위</span>
              <select
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm"
                defaultValue="all"
                name="mode"
              >
                <option value="all">골드박스 + 주요 카테고리</option>
                <option value="goldbox">골드박스만</option>
                <option value="category">선택 카테고리만</option>
              </select>
            </label>
            <label className="mt-4 grid gap-2">
              <span className="text-sm font-bold text-slate-700">카테고리</span>
              <select
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm"
                defaultValue="1014"
                name="categoryId"
              >
                {coupangBestCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="mt-5 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!databaseConfigured}
              type="submit"
            >
              후보 자동 추출
            </button>
          </form>

          <form
            action={addKeywordCandidates}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-bold">후보 직접 추가</h2>
            <p className="mt-2 text-sm text-slate-500">
              쉼표 또는 줄바꿈으로 여러 키워드를 한 번에 추가할 수 있습니다.
            </p>
            <label className="mt-5 grid gap-2">
              <span className="text-sm font-bold text-slate-700">키워드</span>
              <textarea
                className="min-h-28 rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                name="keywords"
                placeholder="예: 물티슈, 캡슐커피, 로봇청소기"
                required
              />
            </label>
            <label className="mt-4 grid gap-2">
              <span className="text-sm font-bold text-slate-700">메모</span>
              <input
                className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                name="note"
                placeholder="예: 네이버 쇼핑 트렌드 후보"
              />
            </label>
            <button
              className="mt-5 rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!databaseConfigured}
              type="submit"
            >
              후보 추가
            </button>
          </form>
        </div>

        <div className="grid gap-6 content-start">
          <form
            action={approveTopKeywordCandidates}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-bold">상위 후보 일괄 승인</h2>
            <p className="mt-2 text-sm text-slate-500">
              점수가 높은 검토 대기 후보를 자동 수집 규칙으로 전환합니다.
              다음 상품 수집 cron부터 가격 추적 대상이 늘어납니다.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">승인 개수</span>
                <input
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm"
                  defaultValue="20"
                  max="100"
                  min="1"
                  name="limit"
                  type="number"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">최소 점수</span>
                <input
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm"
                  defaultValue="70"
                  max="1000"
                  min="0"
                  name="minScore"
                  type="number"
                />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-bold text-slate-700">승인 출처</span>
                <select
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  defaultValue={activeSourceType ?? ""}
                  name="sourceType"
                >
                  {SOURCE_FILTERS.map((filter) => (
                    <option key={filter.label} value={filter.value ?? ""}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="mt-5 w-full rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!databaseConfigured || (overview?.newCount ?? 0) === 0}
              type="submit"
            >
              수집 규칙으로 승인
            </button>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">초기 후보 생성</h2>
            <p className="mt-2 text-sm text-slate-500">
              생활용품, 디지털, 식품 등 자주 할인 감시가 필요한 기본
              키워드를 후보 풀에 넣습니다.
            </p>
            <form action={seedKeywordCandidates}>
              <button
                className="mt-5 w-full rounded-md border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={!databaseConfigured}
                type="submit"
              >
                기본 후보 생성
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold">후보 목록</h2>
          <p className="mt-1 text-sm text-slate-500">
            점수가 높은 후보부터 검토하고, 승인하면 자동 수집 규칙으로
            등록됩니다.
          </p>
        </div>

        {overview && overview.candidates.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {overview.candidates.map((candidate) => (
              <div
                className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_auto] lg:items-center"
                key={candidate.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-950">
                      {candidate.keyword}
                    </strong>
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${getCandidateStatusTone(
                        candidate.status,
                      )}`}
                    >
                      {getCandidateStatusLabel(candidate.status)}
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                      score {candidate.score}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {candidate.source?.name ??
                      getSourceTypeLabel(candidate.sourceType)}
                    {candidate.note ? ` · ${candidate.note}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {candidate.status !== "APPROVED" ? (
                    <form action={approveKeywordCandidate}>
                      <input name="id" type="hidden" value={candidate.id} />
                      <button
                        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                        type="submit"
                      >
                        승인
                      </button>
                    </form>
                  ) : null}
                  {candidate.status !== "REJECTED" ? (
                    <form action={rejectKeywordCandidate}>
                      <input name="id" type="hidden" value={candidate.id} />
                      <button
                        className="rounded-md border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
                        type="submit"
                      >
                        제외
                      </button>
                    </form>
                  ) : (
                    <form action={restoreKeywordCandidate}>
                      <input name="id" type="hidden" value={candidate.id} />
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        type="submit"
                      >
                        복원
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            {databaseConfigured
              ? "조건에 맞는 키워드 후보가 없습니다. 기본 후보를 생성하거나 직접 추가해 주세요."
              : "PostgreSQL 연결 후 키워드 후보를 관리할 수 있습니다."}
          </div>
        )}
      </section>
    </div>
  );
}
