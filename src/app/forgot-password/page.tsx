import Link from "next/link";
import type { Metadata } from "next";
import { requestPasswordResetAction } from "@/app/(auth)/actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    devResetUrl?: string;
    status?: string;
  }>;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "비밀번호 찾기",
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { devResetUrl, status } = await searchParams;

  return (
    <main className="flex-1 bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-bold">비밀번호 찾기</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          가입한 이메일을 입력하면 비밀번호 재설정 링크를 보냅니다.
        </p>

        {status === "invalid" ? (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            이메일을 입력해 주세요.
          </div>
        ) : null}

        {status === "sent" ? (
          <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            계정이 존재하면 재설정 안내를 발송했습니다.
          </div>
        ) : null}

        {devResetUrl ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-bold">개발 모드 재설정 링크</p>
            <Link className="mt-1 block break-all underline" href={devResetUrl}>
              {devResetUrl}
            </Link>
          </div>
        ) : null}

        <form action={requestPasswordResetAction} className="mt-6 grid gap-4">
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
          <button
            className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            type="submit"
          >
            재설정 링크 받기
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-500">
          비밀번호가 기억났나요?{" "}
          <Link className="font-bold text-emerald-700 hover:text-emerald-800" href="/login">
            로그인
          </Link>
        </p>
      </section>
    </main>
  );
}
