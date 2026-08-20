import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { getSession } from "@/lib/auth";

const navItems = [
  { label: "실시간 특가", href: "/deals" },
  { label: "카테고리", href: "/categories" },
  { label: "가격 알림", href: "/alerts" },
];

export async function SiteHeader() {
  const user = await getSession();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Fairprice home">
          <span className="flex h-10 w-10 items-center justify-center bg-emerald-600 text-sm font-black text-white">
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
              className="border-b-2 border-transparent px-4 py-6 text-sm font-bold text-slate-600 transition hover:border-emerald-600 hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {user ? (
          <div className="hidden items-center gap-3 md:flex">
            <div className="hidden text-right lg:block">
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
            <Link className="hidden text-sm font-bold text-slate-600 hover:text-emerald-700 sm:block" href="/admin">
              관리자
            </Link>
          </div>
        ) : (
          <div className="hidden items-center gap-2 md:flex">
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
        <details className="relative ml-2 md:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center border border-slate-300 text-xl font-bold text-slate-700">
            ≡
          </summary>
          <nav className="absolute right-0 top-12 grid w-48 border border-slate-200 bg-white p-2 shadow-xl" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <Link className="px-3 py-3 text-sm font-bold text-slate-700 hover:bg-emerald-50" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="px-3 py-3 text-sm font-bold text-slate-700 hover:bg-emerald-50" href="/admin">
              관리자
            </Link>
            {user ? (
              <form action={logout}>
                <button className="w-full px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50" type="submit">
                  로그아웃
                </button>
              </form>
            ) : (
              <>
                <Link className="px-3 py-3 text-sm font-bold text-slate-700 hover:bg-emerald-50" href="/login">
                  로그인
                </Link>
                <Link className="bg-slate-950 px-3 py-3 text-sm font-bold text-white hover:bg-emerald-600" href="/signup">
                  회원가입
                </Link>
              </>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
