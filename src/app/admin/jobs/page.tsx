import { retryFailedCollectionJobs } from "@/app/admin/jobs/actions";
import { getCollectionJobOverview } from "@/lib/collection-jobs";
import { isDatabaseConfigured } from "@/lib/prisma";

type AdminJobsPageProps = {
  searchParams: Promise<{
    count?: string;
    status?: string;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    COMPLETED: "완료",
    FAILED: "실패",
    PENDING: "대기",
    RUNNING: "실행 중",
  };

  return labels[status] ?? status;
}

function getStatusTone(status: string) {
  if (status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "FAILED") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "RUNNING") {
    return "bg-sky-50 text-sky-700";
  }

  return "bg-amber-50 text-amber-700";
}

function getNotice(status?: string, count?: string) {
  if (status === "database-required") {
    return {
      message: "PostgreSQL 연결이 필요합니다.",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (status === "failed-requeued") {
    return {
      message: `실패 작업 ${Number(count) || 0}개를 다시 대기 상태로 전환했습니다.`,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  return null;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default async function AdminJobsPage({
  searchParams,
}: AdminJobsPageProps) {
  const params = await searchParams;
  const databaseConfigured = isDatabaseConfigured();
  const overview = await getCollectionJobOverview();
  const notice = getNotice(params.status, params.count);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">Collection jobs</p>
            <h2 className="mt-1 text-2xl font-bold">가격 추적 작업 큐</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              승인된 수집 규칙을 작업 단위로 나누어 쿠팡 상품 검색, 가격 갱신,
              가격 이력 저장을 안정적으로 처리합니다. 실패 작업은 원인을 확인한
              뒤 다시 대기 상태로 전환할 수 있습니다.
            </p>
          </div>
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              databaseConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            작업 DB {databaseConfigured ? "연결됨" : "연결 필요"}
          </span>
        </div>
      </section>

      {notice ? (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${notice.tone}`}>
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="대기" value={overview?.pending ?? 0} />
        <StatCard label="실행 중" value={overview?.running ?? 0} />
        <StatCard label="완료" value={overview?.completed ?? 0} />
        <StatCard label="실패" value={overview?.failed ?? 0} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">운영 작업</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              실패 작업을 다시 대기 상태로 바꾸면 다음 수집 파이프라인 실행 때
              재처리됩니다.
            </p>
          </div>
          <form action={retryFailedCollectionJobs}>
            <button
              className="rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!overview || overview.failed === 0}
              type="submit"
            >
              실패 작업 재시도
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold">최근 작업</h2>
          <p className="mt-1 text-sm text-slate-500">
            최신 작업의 상태, 대상 키워드, 실행 결과를 확인합니다.
          </p>
        </div>

        {overview && overview.latest.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {overview.latest.map((job) => (
              <div
                className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_auto] lg:items-center"
                key={job.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-950">{job.keyword}</strong>
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${getStatusTone(
                        job.status,
                      )}`}
                    >
                      {getStatusLabel(job.status)}
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                      우선순위 {job.priority}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      limit {job.limit}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    실행 예정 {formatDate(job.runAfter)} · 시도 {job.attempts}회
                  </p>
                  {job.errorMessage ? (
                    <p className="mt-2 text-sm font-semibold text-rose-700">
                      {job.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-slate-500 lg:text-right">
                  <p>시작 {formatDate(job.startedAt)}</p>
                  <p>종료 {formatDate(job.finishedAt)}</p>
                  <p className="mt-1 font-mono text-xs">{job.id}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            아직 생성된 작업이 없습니다. 자동 스케줄에서 수집 파이프라인을
            실행하면 활성 수집 규칙이 작업으로 등록됩니다.
          </div>
        )}
      </section>
    </div>
  );
}
