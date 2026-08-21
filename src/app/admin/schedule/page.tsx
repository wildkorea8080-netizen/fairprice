import { runSchedulePipeline } from "@/app/admin/schedule/actions";
import { getCronScheduleOverview } from "@/lib/cron-pipeline";
import { isDatabaseConfigured } from "@/lib/prisma";

type SchedulePageProps = {
  searchParams: Promise<{
    failed?: string;
    runId?: string;
    status?: string;
    succeeded?: string;
  }>;
};

type GroupedCount = {
  _count: { _all: number };
};

function getCount<T extends GroupedCount>(
  rows: T[] | undefined,
  key: keyof T,
  value: string,
) {
  const row = rows?.find((item) => item[key] === value);
  return row?._count._all ?? 0;
}

function getStatusTone(status?: string) {
  if (!status) {
    return "";
  }

  return status.includes("failed") || status.includes("required")
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function getStatusMessage({
  failed,
  runId,
  status,
  succeeded,
}: {
  failed: number;
  runId?: string;
  status?: string;
  succeeded: number;
}) {
  if (status === "database-required") {
    return "PostgreSQL 연결이 필요합니다.";
  }

  if (status === "pipeline-failed") {
    return `파이프라인 실행 중 일부 단계가 실패했습니다. 성공 ${succeeded}개, 실패 ${failed}개입니다.${runId ? ` 실행 ID: ${runId}` : ""}`;
  }

  if (status === "pipeline-ran") {
    return `파이프라인 실행이 완료되었습니다. 성공 ${succeeded}개, 실패 ${failed}개입니다.${runId ? ` 실행 ID: ${runId}` : ""}`;
  }

  return "";
}

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(value);
}

function formatDuration(durationMs?: number | null) {
  if (!durationMs) {
    return "-";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}초`;
}

function formatRelativeTime(value?: Date | null) {
  if (!value) {
    return "실행 기록 없음";
  }

  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - value.getTime()) / 60000),
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

function isCronStale(value?: Date | null) {
  if (!value) {
    return true;
  }

  return Date.now() - value.getTime() > 60 * 60 * 1000;
}

function getCronHealthTone(status?: string, startedAt?: Date | null) {
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

function getCronTitle(status?: string, startedAt?: Date | null) {
  if (!status) {
    return "아직 실행 기록이 없습니다";
  }

  if (isCronStale(startedAt)) {
    return "자동화 실행 지연";
  }

  if (status === "SUCCESS") {
    return "최근 자동화 정상";
  }

  if (status === "FAILED") {
    return "최근 자동화 실패";
  }

  return `최근 실행 ${status}`;
}

function formatSteps(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return "-";
}

type StepResultView = {
  durationMs: number;
  error?: string;
  name: string;
  result?: unknown;
  status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStepResults(summary: unknown): StepResultView[] {
  if (!isRecord(summary) || !Array.isArray(summary.results)) {
    return [];
  }

  return summary.results
    .filter(isRecord)
    .map((result) => ({
      durationMs: Number(result.durationMs) || 0,
      error: typeof result.error === "string" ? result.error : undefined,
      name: typeof result.name === "string" ? result.name : "unknown",
      result: result.result,
      status: typeof result.status === "string" ? result.status : "unknown",
    }));
}

function getResultSummary(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  if (isRecord(value.enqueued) || isRecord(value.processed)) {
    const enqueued = isRecord(value.enqueued)
      ? Number(value.enqueued.created) || 0
      : 0;
    const processed = isRecord(value.processed)
      ? Number(value.processed.processed) || 0
      : 0;

    return `작업 생성 ${enqueued}개 · 처리 ${processed}개`;
  }

  return Object.entries(value)
    .filter(([, entry]) => ["number", "string", "boolean"].includes(typeof entry))
    .slice(0, 4)
    .map(([key, entry]) => `${key} ${String(entry)}`)
    .join(" · ");
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function RunButton({
  batchSize = 5,
  children,
  sendDryRun = true,
  steps,
}: {
  batchSize?: number;
  children: React.ReactNode;
  sendDryRun?: boolean;
  steps: string;
}) {
  return (
    <form action={runSchedulePipeline}>
      <input name="steps" type="hidden" value={steps} />
      <input name="batchSize" type="hidden" value={batchSize} />
      <input name="categoryId" type="hidden" value="1014" />
      <input name="sendDryRun" type="hidden" value={String(sendDryRun)} />
      <button
        className="w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

export default async function AdminSchedulePage({
  searchParams,
}: SchedulePageProps) {
  const params = await searchParams;
  const databaseConfigured = isDatabaseConfigured();
  const overview = await getCronScheduleOverview();
  const failed = Number(params.failed) || 0;
  const succeeded = Number(params.succeeded) || 0;
  const statusMessage = getStatusMessage({
    failed,
    runId: params.runId,
    status: params.status,
    succeeded,
  });

  const pipelineUrl =
    "/api/cron/run-pipeline?batchSize=5&clickKeywordLimit=10&sendDryRun=false";
  const latestCronRun = overview?.cronRuns[0];

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">
              Automation schedule
            </p>
            <h2 className="mt-1 text-2xl font-bold">자동 스케줄 관리</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              상품 발견, 키워드 후보 생성, 상품 수집, 알림 평가, 알림 발송을
              하나의 운영 흐름으로 실행합니다. 서버 cron을 붙이기 전에는 아래
              버튼으로 각 단계를 직접 테스트할 수 있습니다.
            </p>
          </div>
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              databaseConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            DB {databaseConfigured ? "연결됨" : "연결 필요"}
          </span>
        </div>
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

      <section
        className={`rounded-lg border p-6 shadow-sm ${getCronHealthTone(
          latestCronRun?.status,
          latestCronRun?.startedAt,
        )}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold">최근 자동화 상태</p>
            <h2 className="mt-1 text-2xl font-bold">
              {getCronTitle(latestCronRun?.status, latestCronRun?.startedAt)}
            </h2>
            <p className="mt-2 text-sm">
              {latestCronRun
                ? `${formatRelativeTime(latestCronRun.startedAt)} · 성공 ${latestCronRun.succeededSteps}개 · 실패 ${latestCronRun.failedSteps}개 · 소요 ${formatDuration(latestCronRun.durationMs)}`
                : "아래 수동 실행 버튼으로 파이프라인을 먼저 실행해 주세요."}
            </p>
            {(overview?.staleCronRuns ?? 0) > 0 ? (
              <p className="mt-2 text-sm font-bold">
                오래 멈춘 실행 {overview?.staleCronRuns}건을 실패로 정리했습니다.
              </p>
            ) : null}
          </div>
          {latestCronRun ? (
            <span className="rounded-md bg-white/80 px-3 py-2 text-sm font-bold text-slate-800">
              {formatSteps(latestCronRun.requestedSteps)}
            </span>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="상품" value={overview?.products ?? 0} />
        <StatCard label="가격 이력" value={overview?.priceHistories ?? 0} />
        <StatCard
          label="대기 작업"
          value={getCount(overview?.jobs, "status", "PENDING")}
        />
        <StatCard
          label="대기 알림"
          value={getCount(overview?.notifications, "status", "PENDING")}
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">수동 실행</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          실제 운영에서는 스케줄러가 호출하지만, 초기 구축 단계에서는 관리자
          화면에서 직접 실행하며 수집량과 알림 흐름을 검증할 수 있습니다.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <RunButton sendDryRun steps="discover,click-keywords,collect,alerts,send">
            전체 파이프라인 실행
          </RunButton>
          <RunButton steps="click-keywords">클릭 기반 후보 생성</RunButton>
          <RunButton batchSize={5} steps="collect">
            수집 작업만 실행
          </RunButton>
          <RunButton sendDryRun steps="alerts,send">
            알림 평가/발송 dry-run
          </RunButton>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          이메일 설정이 없으면 발송 단계는 dry-run으로 실행되어 대기 알림을
          실제 발송 처리하지 않습니다.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">권장 실행 순서</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            ["1", "키워드 발견", "6시간마다 인기 후보를 갱신하고 검증된 상위 후보를 최대 3개 자동 승인합니다."],
            ["2", "클릭 후보", "제휴 클릭 상위 상품에서 추가 후보를 만듭니다."],
            ["3", "상품 수집", "활성 수집 규칙을 작업 큐에 넣고 가격을 갱신합니다."],
            ["4", "알림 평가", "사용자 조건과 특가 상품을 매칭합니다."],
            ["5", "알림 발송", "PENDING 알림을 이메일로 발송합니다."],
          ].map(([step, title, description]) => (
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              key={step}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white">
                {step}
              </span>
              <h3 className="mt-3 font-bold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">통합 cron endpoint</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          자동 운영에서는 이 URL을 서버 cron, Vercel Cron, 또는 클라우드
          스케줄러에 등록하면 됩니다.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-50">
          <code>{pipelineUrl}</code>
        </pre>
        <p className="mt-3 text-sm text-slate-500">
          헤더에는 <code>Authorization: Bearer CRON_SECRET</code>를 포함해야
          합니다.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold">최근 실행 이력</h2>
          <p className="mt-1 text-sm text-slate-500">
            통합 파이프라인이 언제 실행되었고 어느 단계가 성공 또는 실패했는지
            확인합니다.
          </p>
        </div>
        {overview && overview.cronRuns.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {overview.cronRuns.map((run) => (
              <div
                className={`grid gap-4 px-6 py-5 ${
                  params.runId === run.id ? "bg-emerald-50" : ""
                }`}
                key={run.id}
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-slate-950">
                        {formatSteps(run.requestedSteps)}
                      </strong>
                      <span
                        className={`rounded px-2 py-1 text-xs font-bold ${
                          run.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-700"
                            : run.status === "FAILED"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      시작 {formatDate(run.startedAt)} · 종료{" "}
                      {formatDate(run.finishedAt)} · 소요{" "}
                      {formatDuration(run.durationMs)}
                    </p>
                    {run.errorMessage ? (
                      <p className="mt-2 text-sm font-semibold text-rose-700">
                        {run.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-sm text-slate-500 lg:text-right">
                    <p>성공 {run.succeededSteps}개</p>
                    <p>실패 {run.failedSteps}개</p>
                    <p className="mt-1 font-mono text-xs">{run.id}</p>
                  </div>
                </div>
                {getStepResults(run.summary).length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {getStepResults(run.summary).map((step) => (
                      <div
                        className="rounded-md border border-slate-200 bg-white p-3"
                        key={`${run.id}-${step.name}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm text-slate-950">
                            {step.name}
                          </strong>
                          <span
                            className={`rounded px-2 py-1 text-xs font-bold ${
                              step.status === "success"
                                ? "bg-emerald-50 text-emerald-700"
                                : step.status === "failed"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          소요 {formatDuration(step.durationMs)}
                        </p>
                        {step.error ? (
                          <p className="mt-2 text-xs font-semibold text-rose-700">
                            {step.error}
                          </p>
                        ) : null}
                        {getResultSummary(step.result) ? (
                          <p className="mt-2 text-xs text-slate-600">
                            {getResultSummary(step.result)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            아직 파이프라인 실행 이력이 없습니다.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">로컬 실행 명령</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          로컬 서버 또는 자체 서버에서는 아래 npm 명령을 작업 스케줄러에 등록할
          수 있습니다. 명령은 <code>.env.local</code>의 <code>CRON_SECRET</code>
          을 읽어 통합 cron endpoint를 호출합니다.
        </p>
        <div className="mt-4 grid gap-2 text-sm">
          {[
            ["전체 파이프라인", "npm run cron:pipeline"],
            ["알림 평가/발송 dry-run", "npm run cron:alerts"],
            ["수집 작업 처리", "npm run cron:collect"],
            ["키워드 후보 갱신", "npm run cron:discover"],
          ].map(([label, command]) => (
            <div
              className="grid gap-2 rounded-md bg-slate-50 p-3 md:grid-cols-[180px_1fr]"
              key={command}
            >
              <strong>{label}</strong>
              <code className="break-all text-slate-700">{command}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">추천 주기</h2>
        <div className="mt-4 divide-y divide-slate-200 text-sm">
          {[
            ["통합 파이프라인", "30분마다", pipelineUrl],
            [
              "알림만 빠르게 평가",
              "10분마다",
              "/api/cron/run-pipeline?steps=alerts,send",
            ],
            [
              "키워드 후보 확장",
              "하루 2~4회",
              "/api/cron/run-pipeline?steps=discover,click-keywords",
            ],
          ].map(([name, cadence, url]) => (
            <div
              className="grid gap-2 py-4 md:grid-cols-[180px_120px_1fr]"
              key={name}
            >
              <strong>{name}</strong>
              <span className="text-slate-500">{cadence}</span>
              <code className="break-all rounded bg-slate-100 px-2 py-1 text-slate-700">
                {url}
              </code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
