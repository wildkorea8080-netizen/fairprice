"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen items-center bg-slate-50 px-4 text-slate-950">
        <main className="mx-auto w-full max-w-xl text-center">
          <p className="text-sm font-bold uppercase text-rose-700">Error</p>
          <h1 className="mt-3 text-3xl font-bold">화면을 불러오지 못했습니다</h1>
          <p className="mt-3 text-slate-600">
            잠시 후 다시 시도해주세요. 문제가 계속되면 서비스 상태를 확인해주세요.
          </p>
          <button
            className="mt-7 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
            onClick={() => unstable_retry()}
            type="button"
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
