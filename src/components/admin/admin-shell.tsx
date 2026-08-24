import Link from "next/link";

const adminLinks = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/test", label: "진단" },
  { href: "/admin/settings", label: "운영 설정" },
  { href: "/admin/keywords", label: "키워드 후보" },
  { href: "/admin/jobs", label: "작업 큐" },
  { href: "/admin/schedule", label: "자동 스케줄" },
  { href: "/admin/deal-engine", label: "딜 엔진" },
  { href: "/admin/notifications", label: "알림 대기열" },
  { href: "/admin/clicks", label: "제휴 클릭" },
  { href: "/admin/discovery", label: "상품 발견" },
  { href: "/admin/collection", label: "자동 수집" },
  { href: "/admin/products", label: "상품 관리" },
  { href: "/admin/categories", label: "카테고리" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 bg-slate-100 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Admin
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">관리자 콘솔</h1>
              <p className="mt-2 text-sm text-slate-500">
                상품 수집, 가격 추적, 알림, 제휴 클릭, 운영 설정을 관리하는
                페어프라이스 운영 화면입니다.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label="Admin navigation">
              {adminLinks.map((item) => (
                <Link
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}
