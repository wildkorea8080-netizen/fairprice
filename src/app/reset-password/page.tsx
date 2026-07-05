import Link from "next/link";
import type { Metadata } from "next";
import { resetPasswordAction } from "@/app/(auth)/actions";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    status?: string;
    token?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  expired: "재설정 링크가 만료되었거나 이미 사용되었습니다.",
  invalid: "새 비밀번호를 8자 이상 입력하고 확인 값과 맞춰 주세요.",
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "새 비밀번호 설정",
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { status, token = "" } = await searchParams;
  const message = status ? statusMessages[status] : null;

  return (
    <main className="flex-1 bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-bold">새 비밀번호 설정</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          앞으로 사용할 새 비밀번호를 입력해 주세요.
        </p>

        {message ? (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {message}
          </div>
        ) : null}

        {!token ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            재설정 토큰이 없습니다. 비밀번호 찾기를 다시 진행해 주세요.
          </div>
        ) : null}

        <form action={resetPasswordAction} className="mt-6 grid gap-4">
          <input name="token" type="hidden" value={token} />
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">새 비밀번호</span>
            <input
              autoComplete="new-password"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">새 비밀번호 확인</span>
            <input
              autoComplete="new-password"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              minLength={8}
              name="passwordConfirm"
              required
              type="password"
            />
          </label>
          <button
            className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!token}
            type="submit"
          >
            비밀번호 변경
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-500">
          링크가 만료되었나요?{" "}
          <Link className="font-bold text-emerald-700 hover:text-emerald-800" href="/forgot-password">
            다시 요청하기
          </Link>
        </p>
      </section>
    </main>
  );
}
