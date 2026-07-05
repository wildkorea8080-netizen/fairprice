import type { Metadata } from "next";
import { getLegalConfig } from "@/lib/legal-config";

export const metadata: Metadata = {
  alternates: {
    canonical: "/terms",
  },
  description:
    "페어프라이스의 쿠팡 가격 추적, 특가 알림, 제휴 링크 이용 기준을 안내합니다.",
  title: "이용약관",
};

export default function TermsPage() {
  const { contactEmail, operatorName } = getLegalConfig();

  return (
    <main className="flex-1 bg-slate-50 px-4 py-12 text-slate-950">
      <article className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold text-emerald-700">Terms</p>
        <h1 className="mt-2 text-3xl font-bold">이용약관</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-600">
          <p>
            페어프라이스는 상품 할인 정보를 정리하고 관심 조건에 따른 알림을 제공하는
            서비스입니다. 표시 가격과 재고는 쿠팡의 실제 판매 페이지에서 달라질 수 있습니다.
          </p>
          <p>
            상품 링크에는 쿠팡 파트너스 활동으로 일정액의 수수료를 제공받을 수 있는 링크가
            포함될 수 있습니다.
          </p>
          <p>현재 버전은 기능 검증을 위한 MVP 데모이며 실제 구매 계약의 당사자가 아닙니다.</p>
          <p>
            서비스 운영자는 {operatorName}이며, 서비스 이용 문의는 이메일{" "}
            <a className="font-bold text-emerald-700" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            로 접수합니다.
          </p>
        </div>
      </article>
    </main>
  );
}
