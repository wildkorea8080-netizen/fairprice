import Link from "next/link";
import type { Metadata } from "next";
import { signup } from "@/app/(auth)/actions";

type SignupPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  "database-required": "회원가입을 처리하려면 데이터베이스 연결이 필요합니다.",
  exists: "이미 가입된 이메일입니다. 로그인해 주세요.",
  invalid: "이름, 이메일, 8자 이상 비밀번호를 입력해 주세요.",
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "회원가입",
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { status } = await searchParams;
  const message = status ? statusMessages[status] : null;

  return (
    <main className="flex-1 bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Signup</p>
        <h1 className="mt-3 text-3xl font-bold">회원가입</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          관심 상품과 알림 조건을 저장하기 위한 페어프라이스 회원 계정을 만듭니다.
        </p>

        {message ? (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {message}
          </div>
        ) : null}

        <form action={signup} className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">이름</span>
            <input
              autoComplete="name"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              minLength={2}
              name="name"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">이메일</span>
            <input
              autoComplete="email"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">비밀번호</span>
            <input
              autoComplete="new-password"
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
            가입하기
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-500">
          이미 계정이 있나요?{" "}
          <Link className="font-bold text-emerald-700 hover:text-emerald-800" href="/login">
            로그인
          </Link>
        </p>
      </section>
    </main>
  );
}
