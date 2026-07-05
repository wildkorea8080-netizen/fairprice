import Link from "next/link";
import type { Metadata } from "next";
import { login } from "@/app/(auth)/actions";
import { demoAdminEmail } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    status?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  invalid: "이메일 또는 비밀번호가 올바르지 않습니다.",
  "password-reset": "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.",
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "로그인",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next = "/", status } = await searchParams;
  const message = status ? statusMessages[status] : null;
  const isSuccess = status === "password-reset";

  return (
    <main className="flex-1 bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Login</p>
        <h1 className="mt-3 text-3xl font-bold">로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          관심 상품, 가격 알림, 관리자 기능을 사용하려면 로그인해 주세요. 관리자 계정은{" "}
          {demoAdminEmail}입니다.
        </p>

        {message ? (
          <div
            className={`mt-5 rounded-md border px-3 py-2 text-sm font-semibold ${
              isSuccess
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <form action={login} className="mt-6 grid gap-4">
          <input name="next" type="hidden" value={next} />
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">이메일</span>
            <input
              autoComplete="email"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              name="email"
              placeholder="admin@fairprice.local"
              required
              type="email"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">비밀번호</span>
            <input
              autoComplete="current-password"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            type="submit"
          >
            로그인
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <Link className="font-bold text-emerald-700 hover:text-emerald-800" href="/forgot-password">
            비밀번호 찾기
          </Link>
          <span>
            계정이 없나요?{" "}
            <Link className="font-bold text-emerald-700 hover:text-emerald-800" href="/signup">
              회원가입
            </Link>
          </span>
        </div>
      </section>
    </main>
  );
}
