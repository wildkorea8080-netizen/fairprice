import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center bg-slate-50 px-4 py-16 text-slate-950">
      <section className="mx-auto w-full max-w-xl text-center">
        <p className="text-sm font-bold uppercase text-emerald-700">404</p>
        <h1 className="mt-3 text-3xl font-bold">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-slate-600">
          주소가 변경되었거나 더 이상 제공하지 않는 페이지입니다.
        </p>
        <Link
          className="mt-7 inline-flex rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          href="/"
        >
          홈으로 이동
        </Link>
      </section>
    </main>
  );
}
