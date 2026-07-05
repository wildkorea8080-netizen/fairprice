import Link from "next/link";
import {
  getAdminSettingsStatus,
  type AdminSettingItem,
} from "@/lib/admin-settings";

const groupLabels: Record<AdminSettingItem["group"], string> = {
  automation: "자동화",
  core: "핵심 인프라",
  growth: "검색 노출",
  security: "보안",
};

const groupDescriptions: Record<AdminSettingItem["group"], string> = {
  automation: "상품 수집, 가격 추적, 알림 발송을 계속 돌리기 위한 설정입니다.",
  core: "서비스가 정상적으로 실행되고 외부에 올바른 주소로 노출되기 위한 기본 설정입니다.",
  growth: "네이버와 구글 검색 노출을 관리하기 위한 인증 설정입니다.",
  security: "관리자 계정과 로그인 세션을 보호하기 위한 설정입니다.",
};

function StatusPill({ isReady }: { isReady: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${
        isReady
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {isReady ? "준비됨" : "확인 필요"}
    </span>
  );
}

function SettingCard({ item }: { item: AdminSettingItem }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">{item.label}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
        </div>
        <StatusPill isReady={item.isReady} />
      </div>
      <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
        {item.value}
      </p>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const status = await getAdminSettingsStatus();
  const groups = Object.keys(groupLabels) as AdminSettingItem["group"][];
  const progress = Math.round((status.readyCount / status.totalCount) * 100);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Operations
            </p>
            <h2 className="mt-2 text-2xl font-bold">운영 설정 점검</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              페어프라이스를 실제 서비스로 운영하기 전에 필요한 환경변수와 외부
              연동 상태를 확인합니다. 민감한 값은 노출하지 않고 준비 여부만
              표시합니다.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-right">
            <p className="text-sm font-semibold text-slate-500">준비율</p>
            <p className="mt-1 text-3xl font-bold text-slate-950">{progress}%</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {status.readyCount}/{status.totalCount} 항목 완료
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">서비스 URL</p>
          <p className="mt-2 break-all text-lg font-bold text-slate-950">
            {status.appUrl}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">배포 모드</p>
          <p className="mt-2 text-lg font-bold text-slate-950">
            {status.deploymentMode}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Health API</p>
          <Link
            className="mt-2 inline-block text-lg font-bold text-emerald-700 hover:text-emerald-800"
            href="/api/health"
          >
            /api/health
          </Link>
        </div>
      </section>

      {groups.map((group) => {
        const items = status.items.filter((item) => item.group === group);

        return (
          <section className="grid gap-4" key={group}>
            <div>
              <h2 className="text-xl font-bold">{groupLabels[group]}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {groupDescriptions[group]}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => (
                <SettingCard item={item} key={item.label} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <h2 className="font-bold">운영 전 권장 작업</h2>
        <p className="mt-2">
          production 모드로 전환할 때는 `NEXT_PUBLIC_APP_URL`을 실제 도메인으로
          바꾸고, `FAIRPRICE_AUTH_SECRET`, `FAIRPRICE_ADMIN_PASSWORD`,
          `CRON_SECRET`을 로컬 개발값과 다른 긴 값으로 교체하세요.
        </p>
      </section>
    </div>
  );
}
