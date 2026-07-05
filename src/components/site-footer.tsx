import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p>© 2026 Fairprice. Coupang deal monitoring service.</p>
          <p className="mt-1 text-xs">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
            수수료를 제공받습니다.
          </p>
        </div>
        <div className="flex gap-4">
          <Link className="hover:text-slate-900" href="/affiliate-disclosure">
            제휴 고지
          </Link>
          <Link className="hover:text-slate-900" href="/terms">
            이용약관
          </Link>
          <Link className="hover:text-slate-900" href="/privacy">
            개인정보처리방침
          </Link>
        </div>
      </div>
    </footer>
  );
}
