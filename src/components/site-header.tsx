import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { getSession } from "@/lib/auth";

const navItems = [
  { label: "특가", href: "/deals" },
  { label: "카테고리", href: "/categories" },
  { label: "알림 설정", href: "/alerts" },
  { label: "관리자", href: "/admin" },
];

export async function SiteHeader() {
  const user = await getSession();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Fairprice home">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white">
            FP
          </span>
          <span>
            <span className="block text-base font-bold leading-5 text-slate-950">
              페어프라이스
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              쿠팡 할인 감시
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role === "admin" ? "관리자" : "회원"}</p>
            </div>
            <form action={logout}>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                type="submit"
              >
                로그아웃
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              회원가입
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
