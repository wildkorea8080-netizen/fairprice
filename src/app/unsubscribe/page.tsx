import Link from "next/link";
import type { Metadata } from "next";
import { unsubscribeAlertsAction } from "@/app/unsubscribe/actions";

type UnsubscribePageProps = {
  searchParams: Promise<{
    count?: string;
    status?: string;
    token?: string;
  }>;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "알림 수신거부",
};

export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const { count, status, token = "" } = await searchParams;

  return (
    <main className="flex-1 bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Alerts
        </p>
        <h1 className="mt-3 text-3xl font-bold">알림 수신거부</h1>

        {status === "done" ? (
          <>
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              알림 {count ?? 0}건을 껐습니다. 더 이상 특가 알림 메일이 발송되지
              않습니다.
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              알림 조건은 삭제하지 않고 꺼두기만 했습니다. 다시 받고 싶으시면
              로그인 후 알림 설정에서 켜시면 됩니다.
            </p>
            <Link
              className="mt-5 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
              href="/alerts"
            >
              알림 설정으로 이동
            </Link>
          </>
        ) : status === "invalid" ? (
          <>
            <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              수신거부 링크가 올바르지 않습니다.
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              메일에 있는 링크를 다시 확인해 주세요. 계속 문제가 있으면 로그인
              후 알림 설정에서 직접 끄실 수 있습니다.
            </p>
            <Link
              className="mt-5 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
              href="/alerts"
            >
              알림 설정으로 이동
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              등록하신 모든 특가 알림을 끕니다. 알림 조건은 삭제되지 않으며,
              나중에 알림 설정에서 다시 켤 수 있습니다.
            </p>
            <form action={unsubscribeAlertsAction} className="mt-6">
              <input name="token" type="hidden" value={token} />
              <button
                className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white"
                type="submit"
              >
                모든 알림 끄기
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
