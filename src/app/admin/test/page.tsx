import Link from "next/link";
import {
  getAdminTestReport,
  type DiagnosticCheck,
  type DiagnosticStatus,
} from "@/lib/admin-test";

const statusLabels: Record<DiagnosticStatus, string> = {
  fail: "실패",
  pass: "통과",
  warn: "주의",
};

const statusTones: Record<DiagnosticStatus, string> = {
  fail: "border-rose-200 bg-rose-50 text-rose-700",
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
};

function formatCheckedAt(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(value);
}

function StatusBadge({ status }: { status: DiagnosticStatus }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${statusTones[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function SummaryCard({ label, tone, value }: { label: string; tone: string; value: number }) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${tone}`}>
      <p className="text-sm font-semibold opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function CheckCard({ check }: { check: DiagnosticCheck }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">{check.label}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {check.description}
          </p>
        </div>
        <StatusBadge status={check.status} />
      </div>
      <p className="mt-4 break-all rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
        {check.detail}
      </p>
    </div>
  );
}

export default async function AdminTestPage() {
  const report = await getAdminTestReport();
  const readyRate = Math.round((report.passCount / report.totalCount) * 100);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Diagnostics
            </p>
            <h2 className="mt-2 text-2xl font-bold">배포 전 진단</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              배포 전에 필요한 설정, 데이터 적재, 자동화, SEO 엔드포인트 상태를
              한 화면에서 확인합니다. 운영 서비스 준비 항목은 DB, 공개 URL, 쿠팡 API,
              cron 비밀값, 이메일 설정을 함께 확인하며 민감한 API 키와 비밀값은
              표시하지 않습니다.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-right">
            <p className="text-sm font-semibold text-slate-500">통과율</p>
            <p className="mt-1 text-3xl font-bold text-slate-950">{readyRate}%</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {formatCheckedAt(report.checkedAt)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="전체 항목"
          tone="border-slate-200 bg-white text-slate-950"
          value={report.totalCount}
        />
        <SummaryCard
          label="통과"
          tone="border-emerald-200 bg-emerald-50 text-emerald-800"
          value={report.passCount}
        />
        <SummaryCard
          label="주의"
          tone="border-amber-200 bg-amber-50 text-amber-800"
          value={report.warnCount}
        />
        <SummaryCard
          label="실패"
          tone="border-rose-200 bg-rose-50 text-rose-800"
          value={report.failCount}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">빠른 확인 링크</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["/api/health", "Health API"],
            ["/sitemap.xml", "Sitemap"],
            ["/robots.txt", "Robots"],
            ["/feed.xml", "RSS"],
            ["/admin/schedule", "자동 스케줄"],
            ["/admin/notifications", "알림 대기열"],
          ].map(([href, label]) => (
            <Link
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {report.groups.map((group) => (
        <section className="grid gap-4" key={group.label}>
          <div>
            <h2 className="text-xl font-bold">{group.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{group.description}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {group.checks.map((check) => (
              <CheckCard check={check} key={`${group.label}-${check.label}`} />
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <h2 className="font-bold">진단 결과 해석</h2>
        <p className="mt-2">
          `실패` 항목은 배포 전에 먼저 해결하는 것이 좋습니다. `주의` 항목은
          로컬 개발에서는 허용될 수 있지만, 실제 운영에서는 쿠팡 수집, cron,
          이메일, 검색 노출 품질에 영향을 줄 수 있습니다.
        </p>
      </section>
    </div>
  );
}
