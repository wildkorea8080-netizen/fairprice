import Link from "next/link";
import {
  evaluateNotificationsNow,
  retryFailedNotifications,
  sendTestNotificationNow,
  sendNotificationsNow,
} from "@/app/admin/notifications/actions";
import {
  getNotificationOverview,
  type NotificationStatusFilter,
} from "@/lib/alert-evaluator";
import { getNotificationEmailStatus } from "@/lib/notification-sender";
import { isDatabaseConfigured } from "@/lib/prisma";

type AdminNotificationsPageProps = {
  searchParams: Promise<{
    created?: string;
    count?: string;
    error?: string;
    failed?: string;
    filter?: string;
    inspected?: string;
    matched?: string;
    q?: string;
    rules?: string;
    sent?: string;
    skipped?: string;
    status?: string;
    to?: string;
  }>;
};

type NotificationOverview = NonNullable<
  Awaited<ReturnType<typeof getNotificationOverview>>
>;
type NotificationLog = NotificationOverview["latest"][number];

const WON_FORMATTER = new Intl.NumberFormat("ko-KR");
const NOTIFICATION_FILTERS = [
  { label: "전체", value: undefined },
  { label: "대기", value: "PENDING" },
  { label: "발송 완료", value: "SENT" },
  { label: "실패", value: "FAILED" },
] satisfies Array<{
  label: string;
  value?: NotificationStatusFilter;
}>;

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function normalizeFilter(value?: string): NotificationStatusFilter | undefined {
  if (value === "PENDING" || value === "SENT" || value === "FAILED") {
    return value;
  }

  return undefined;
}

function normalizeQuery(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function notificationHref(filter?: NotificationStatusFilter, query = "") {
  const params = new URLSearchParams();

  if (filter) {
    params.set("filter", filter);
  }

  if (query) {
    params.set("q", query);
  }

  const search = params.toString();

  return search ? `/admin/notifications?${search}` : "/admin/notifications";
}

function describeAlertRule(rule: NotificationLog["alertRule"]) {
  if (!rule) {
    return "알림 조건 없음";
  }

  const labels: string[] = [];

  if (rule.keyword) {
    labels.push(`키워드 ${rule.keyword}`);
  }

  if (rule.maxPrice !== null) {
    labels.push(`${WON_FORMATTER.format(rule.maxPrice)}원 이하`);
  }

  if (rule.minDiscountRate !== null) {
    labels.push(`${rule.minDiscountRate}% 이상 할인`);
  }

  if (rule.productId && labels.length === 0) {
    labels.push("상품별 가격 알림");
  }

  return labels.length > 0 ? labels.join(" · ") : "조건 없음";
}

function formatWon(value: number) {
  return `${WON_FORMATTER.format(value)}원`;
}

function getStatusLabel(status: NotificationLog["status"]) {
  if (status === "PENDING") {
    return "대기";
  }

  if (status === "SENT") {
    return "발송 완료";
  }

  return "실패";
}

function getStatusBadgeClass(status: NotificationLog["status"]) {
  if (status === "PENDING") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "SENT") {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-rose-50 text-rose-700";
}

function getStatusTone(status?: string) {
  if (!status) {
    return "";
  }

  if (status === "database-required" || status === "email-required") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return status === "sent"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-sky-200 bg-sky-50 text-sky-800";
}

function getStatusMessage(params: Awaited<AdminNotificationsPageProps["searchParams"]>) {
  if (params.status === "database-required") {
    return "PostgreSQL 연결이 필요합니다.";
  }

  if (params.status === "email-required") {
    return "실제 발송을 하려면 RESEND_API_KEY와 EMAIL_FROM 설정이 필요합니다.";
  }

  if (params.status === "test-email-required") {
    return "테스트 메일을 받을 이메일 주소를 입력해 주세요.";
  }

  if (params.status === "test-email-sent") {
    return `테스트 메일을 ${params.to ?? "입력한 주소"}로 발송했습니다.`;
  }

  if (params.status === "test-email-failed") {
    return `테스트 메일 발송에 실패했습니다.${params.error ? ` ${params.error}` : ""}`;
  }

  if (params.status === "evaluated") {
    return `알림 평가 완료: 규칙 ${params.rules ?? 0}개, 매칭 ${
      params.matched ?? 0
    }개, 새 대기열 ${params.created ?? 0}개, 중복 제외 ${
      params.skipped ?? 0
    }개`;
  }

  if (params.status === "send-dry-run") {
    return `발송 dry-run 완료: 확인 ${params.inspected ?? 0}개, 실제 발송 0개, 대기 유지 ${
      params.skipped ?? 0
    }개`;
  }

  if (params.status === "sent") {
    return `발송 처리 완료: 확인 ${params.inspected ?? 0}개, 발송 ${
      params.sent ?? 0
    }개, 실패 ${params.failed ?? 0}개`;
  }

  if (params.status === "failed-retried") {
    return `실패 알림 ${params.count ?? 0}건을 다시 발송 대기 상태로 변경했습니다.`;
  }

  return "";
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function getFilterCount(
  overview: NotificationOverview | null,
  filter?: NotificationStatusFilter,
) {
  if (!overview) {
    return 0;
  }

  if (filter === "PENDING") {
    return overview.pending;
  }

  if (filter === "SENT") {
    return overview.sent;
  }

  if (filter === "FAILED") {
    return overview.failed;
  }

  return overview.pending + overview.sent + overview.failed;
}

function getEmptyMessage(filter?: NotificationStatusFilter, query = "") {
  if (query) {
    return `"${query}" 검색 결과가 없습니다. 상품명, 이메일, 알림 제목을 다시 확인해 주세요.`;
  }

  if (filter === "PENDING") {
    return "현재 발송 대기 중인 알림이 없습니다.";
  }

  if (filter === "SENT") {
    return "아직 발송 완료된 알림이 없습니다.";
  }

  if (filter === "FAILED") {
    return "실패한 알림이 없습니다.";
  }

  return "아직 생성된 알림이 없습니다. 상품별 가격 알림 또는 키워드 알림을 만든 뒤 알림 조건 평가를 실행하면 이곳에 발송 후보가 쌓입니다.";
}

export default async function AdminNotificationsPage({
  searchParams,
}: AdminNotificationsPageProps) {
  const params = await searchParams;
  const databaseConfigured = isDatabaseConfigured();
  const emailStatus = getNotificationEmailStatus();
  const activeFilter = normalizeFilter(params.filter);
  const query = normalizeQuery(params.q);
  const overview = await getNotificationOverview(activeFilter, query);
  const statusMessage = getStatusMessage(params);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">
              Notification outbox
            </p>
            <h2 className="mt-1 text-2xl font-bold">특가 알림 발송 대기열</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              DB 알림 조건과 가격 추적 상품이 매칭되면 이메일 발송 후보가
              생성됩니다. 이 화면에서 평가와 발송을 수동으로 실행하며 자동화
              흐름을 검증할 수 있습니다.
            </p>
          </div>
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              databaseConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            알림 DB {databaseConfigured ? "연결됨" : "연결 필요"}
          </span>
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              emailStatus.isConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            이메일 {emailStatus.isConfigured ? "설정됨" : "설정 필요"}
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

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="발송 대기" value={overview?.pending ?? 0} />
        <MetricCard label="발송 완료" value={overview?.sent ?? 0} />
        <MetricCard label="실패" value={overview?.failed ?? 0} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">수동 실행</h2>
            <p className="mt-2 text-sm text-slate-500">
              상품별 목표가/할인율 알림이 제대로 매칭되는지 평가하고, 대기열에
              쌓인 알림을 dry-run 또는 실제 발송으로 처리합니다.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <form action={evaluateNotificationsNow}>
            <button
              className="w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              type="submit"
            >
              알림 조건 평가
            </button>
          </form>
          <form action={sendNotificationsNow}>
            <input name="dryRun" type="hidden" value="true" />
            <input name="limit" type="hidden" value="20" />
            <button
              className="w-full rounded-md border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              type="submit"
            >
              발송 dry-run
            </button>
          </form>
          <form action={sendNotificationsNow}>
            <input name="dryRun" type="hidden" value="false" />
            <input name="limit" type="hidden" value="20" />
            <button
              className="w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={
                !databaseConfigured ||
                !emailStatus.isConfigured ||
                (overview?.pending ?? 0) === 0
              }
              type="submit"
            >
              실제 발송 처리
            </button>
          </form>
          <form action={retryFailedNotifications}>
            <button
              className="w-full rounded-md border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
              disabled={!databaseConfigured || (overview?.failed ?? 0) === 0}
              type="submit"
            >
              실패 알림 재시도
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {emailStatus.isConfigured
            ? `현재 발신 주소는 ${emailStatus.from}입니다. 먼저 dry-run으로 대상 개수를 확인하는 것을 권장합니다.`
            : "실제 발송을 사용하려면 .env.local에 RESEND_API_KEY와 EMAIL_FROM을 설정해 주세요. 설정 전에는 dry-run만 사용할 수 있습니다."}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">이메일 설정 테스트</h2>
            <p className="mt-2 text-sm text-slate-500">
              실제 알림 발송과 같은 Resend 경로로 테스트 메일을 보냅니다.
              운영 전에는 관리자 이메일로 먼저 확인해 주세요.
            </p>
          </div>
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              emailStatus.isConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {emailStatus.isConfigured ? emailStatus.from : "설정 필요"}
          </span>
        </div>
        <form
          action={sendTestNotificationNow}
          className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"
        >
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">수신 이메일</span>
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              defaultValue={params.to ?? "admin@fairprice.local"}
              name="to"
              placeholder="admin@fairprice.local"
              type="email"
            />
          </label>
          <button
            className="self-end rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!emailStatus.isConfigured}
            type="submit"
          >
            테스트 메일 발송
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          설정값은 서버 환경변수에서만 읽고 화면에는 마스킹된 발신 주소만
          표시합니다.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">최근 알림</h2>
              <p className="mt-1 text-sm text-slate-500">
                같은 사용자, 같은 알림 조건, 같은 상품은 한 번만 생성해서 중복
                발송을 방지합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_FILTERS.map((filter) => {
                const isActive = filter.value === activeFilter;
                const count = getFilterCount(overview, filter.value);

                return (
                  <Link
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${
                      isActive
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    href={notificationHref(filter.value, query)}
                    key={filter.label}
                  >
                    <span>{filter.label}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-white text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <form action="/admin/notifications" className="mt-5 flex flex-col gap-3 sm:flex-row">
            {activeFilter ? (
              <input name="filter" type="hidden" value={activeFilter} />
            ) : null}
            <input
              className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              defaultValue={query}
              name="q"
              placeholder="상품명, 이메일, 알림 제목 검색"
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
                href={notificationHref(activeFilter)}
              >
                초기화
              </Link>
            ) : null}
          </form>
        </div>

        {overview && overview.latest.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {overview.latest.map((log) => (
              <div
                className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_auto] lg:items-center"
                key={log.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-950">{log.subject}</strong>
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${getStatusBadgeClass(
                        log.status,
                      )}`}
                    >
                      {getStatusLabel(log.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {log.user.email} · {log.product.title}
                  </p>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-md bg-slate-50 px-3 py-2">
                      <dt className="text-xs font-bold text-slate-500">
                        현재가
                      </dt>
                      <dd className="mt-1 font-bold text-slate-950">
                        {formatWon(log.product.currentPrice)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-slate-50 px-3 py-2">
                      <dt className="text-xs font-bold text-slate-500">
                        정상가
                      </dt>
                      <dd className="mt-1 font-bold text-slate-950">
                        {formatWon(log.product.originalPrice)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-emerald-50 px-3 py-2">
                      <dt className="text-xs font-bold text-emerald-700">
                        할인율
                      </dt>
                      <dd className="mt-1 font-bold text-emerald-800">
                        {log.product.discountRate}%
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    조건: {describeAlertRule(log.alertRule)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                      href={`/products/${log.product.slug}`}
                    >
                      상품 상세
                    </Link>
                    <a
                      className="rounded-md border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
                      href={log.product.partnerUrl}
                      rel="noreferrer sponsored"
                      target="_blank"
                    >
                      쿠팡 제휴 링크
                    </a>
                  </div>
                  {log.errorMessage ? (
                    <p className="mt-2 text-sm font-semibold text-rose-700">
                      {log.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-slate-500 lg:text-right">
                  <p>생성 {formatDate(log.createdAt)}</p>
                  <p>발송 {formatDate(log.sentAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            {getEmptyMessage(activeFilter, query)}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">발송 cron</h2>
        <p className="mt-2 text-sm text-slate-500">
          <code className="rounded bg-slate-100 px-1.5 py-1 text-slate-700">
            /api/cron/send-notifications
          </code>
          를 호출하면 PENDING 알림을 발송합니다. 메일 설정이 없으면 dry-run으로
          실행해 대기열을 소모하지 않을 수 있습니다.
        </p>
      </section>
    </div>
  );
}
