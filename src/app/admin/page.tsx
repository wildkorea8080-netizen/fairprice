import Link from "next/link";
import { getAdminDashboardOverview } from "@/lib/admin-dashboard";
import { formatKoreanPrice } from "@/lib/deal-products";

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeTime(date: Date | null) {
  if (!date) {
    return "실행 기록 없음";
  }

  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (diffMinutes < 1) {
    return "방금 전";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  return `${Math.floor(diffHours / 24)}일 전`;
}

function isCronStale(date?: Date | null) {
  if (!date) {
    return true;
  }

  return Date.now() - date.getTime() > 60 * 60 * 1000;
}

function getCronTone(status?: string, startedAt?: Date | null) {
  if (!status || isCronStale(startedAt)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "SUCCESS") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "FAILED") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function getAutomationTitle(status?: string, startedAt?: Date | null) {
  if (!status) {
    return "자동화 실행 기록 없음";
  }

  if (isCronStale(startedAt)) {
    return "자동화 실행 지연";
  }

  if (status === "SUCCESS") {
    return "자동화 정상 실행 중";
  }

  if (status === "FAILED") {
    return "자동화 실패 확인 필요";
  }

  return `자동화 ${status}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const overview = await getAdminDashboardOverview();

  if (!overview) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
        PostgreSQL 연결이 필요합니다. 운영 대시보드를 확인하려면 데이터베이스
        설정을 먼저 완료해 주세요.
      </div>
    );
  }

  const latestCron = overview.latestCronRun;

  return (
    <div className="grid gap-6">
      <section
        className={`rounded-lg border p-6 shadow-sm ${getCronTone(
          latestCron?.status,
          latestCron?.startedAt,
        )}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold">자동화 상태</p>
            <h2 className="mt-1 text-2xl font-bold">
              {getAutomationTitle(latestCron?.status, latestCron?.startedAt)}
            </h2>
            <p className="mt-2 text-sm">
              {latestCron
                ? `마지막 실행 ${formatRelativeTime(
                    latestCron.startedAt,
                  )} · 성공 ${latestCron.succeededSteps}개 · 실패 ${latestCron.failedSteps}개`
                : "자동 스케줄을 한 번 실행하면 이곳에 최근 상태가 표시됩니다."}
            </p>
          </div>
          <Link
            className="rounded-md bg-white/80 px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-white"
            href="/admin/schedule"
          >
            스케줄 확인
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="활성 상품" value={`${overview.trackedProducts}개`} />
        <StatCard label="가격 이력" value={`${overview.priceHistories}개`} />
        <StatCard label="제휴 클릭" value={`${overview.clickLogs}회`} />
        <StatCard label="최고 할인율" value={`${overview.highestDiscount}%`} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="대표 상품" value={`${overview.featuredProducts}개`} />
        <StatCard label="숨김 상품" value={`${overview.hiddenProducts}개`} />
        <StatCard label="카테고리" value={`${overview.categories}개`} />
        <StatCard label="평균 할인율" value={`${overview.averageDiscount}%`} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">Deal Engine</p>
            <h2 className="mt-1 text-xl font-bold">가격 분석 및 특가 탐지</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              첫 관측 상품은 수집 중으로 표시됩니다. 가격 표본과 추적 기간이
              쌓여 신뢰도가 확보되고 80점 이상 가격 신호가 발생하면 특가 후보가
              되며, 90점 이상은 활성 Hot Deal로 자동 승격됩니다.
            </p>
          </div>
          <Link
            className="rounded-md border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href="/admin/products"
          >
            분석 상품 확인
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="분석 완료"
            value={`${overview.dealEngine.analyzedProducts}개`}
          />
          <StatCard
            label="수집 중"
            value={`${overview.dealEngine.collecting}개`}
          />
          <StatCard
            label="신뢰도 확보"
            value={`${overview.dealEngine.reliable}개`}
          />
          <StatCard
            label="80점 이상"
            value={`${overview.dealEngine.highScoreProducts}개`}
          />
          <StatCard
            label="활성 Hot Deal"
            value={`${overview.dealEngine.activeDeals}개`}
          />
        </div>
        <p className="mt-4 text-sm text-slate-500">
          누적 탐지 이벤트 {overview.dealEngine.dealEvents}건
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">수집 작업</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">대기</dt>
              <dd className="mt-1 text-2xl font-bold">{overview.jobs.pending}</dd>
            </div>
            <div>
              <dt className="text-slate-500">실행 중</dt>
              <dd className="mt-1 text-2xl font-bold">{overview.jobs.running}</dd>
            </div>
            <div>
              <dt className="text-slate-500">완료</dt>
              <dd className="mt-1 text-2xl font-bold">{overview.jobs.completed}</dd>
            </div>
            <div>
              <dt className="text-slate-500">실패</dt>
              <dd className="mt-1 text-2xl font-bold text-rose-700">
                {overview.jobs.failed}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">알림</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">대기</dt>
              <dd className="mt-1 text-2xl font-bold">{overview.notifications.pending}</dd>
            </div>
            <div>
              <dt className="text-slate-500">발송</dt>
              <dd className="mt-1 text-2xl font-bold">{overview.notifications.sent}</dd>
            </div>
            <div>
              <dt className="text-slate-500">실패</dt>
              <dd className="mt-1 text-2xl font-bold text-rose-700">
                {overview.notifications.failed}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">키워드 후보</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">신규</dt>
              <dd className="mt-1 text-2xl font-bold">{overview.keywords.new}</dd>
            </div>
            <div>
              <dt className="text-slate-500">승인</dt>
              <dd className="mt-1 text-2xl font-bold">{overview.keywords.approved}</dd>
            </div>
            <div>
              <dt className="text-slate-500">제외</dt>
              <dd className="mt-1 text-2xl font-bold">{overview.keywords.rejected}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">빠른 작업</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            href="/admin/schedule"
          >
            자동 스케줄 실행
          </Link>
          <Link
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href="/admin/settings"
          >
            운영 설정 확인
          </Link>
          <Link
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href="/admin/keywords"
          >
            키워드 후보 관리
          </Link>
          <Link
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href="/admin/products"
          >
            상품 목록 관리
          </Link>
          <Link
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href="/admin/notifications"
          >
            알림 대기열 확인
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold">최근 확인 상품</h2>
          <p className="mt-1 text-sm text-slate-500">
            쿠팡 API 수집 또는 가격 추적에서 최근 갱신된 상품입니다.
          </p>
        </div>
        <div className="divide-y divide-slate-200">
          {overview.latestProducts.length > 0 ? (
            overview.latestProducts.map((product) => (
              <div
                className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_auto_auto] md:items-center"
                key={product.id}
              >
                <div>
                  <p className="font-bold text-slate-950">{product.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {product.category.name} · 마지막 확인 {formatDate(product.lastCheckedAt)}
                  </p>
                </div>
                <p className="text-sm font-bold">
                  {formatKoreanPrice(product.currentPrice)}
                </p>
                <span className="w-fit rounded-md bg-rose-50 px-2 py-1 text-sm font-bold text-rose-700">
                  {product.discountRate}%
                </span>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-sm text-slate-500">
              아직 수집된 쿠팡 상품이 없습니다. 자동 스케줄에서 상품 수집을 먼저
              실행해 주세요.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
