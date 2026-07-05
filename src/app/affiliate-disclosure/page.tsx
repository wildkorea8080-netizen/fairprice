import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/affiliate-disclosure",
  },
  description:
    "페어프라이스의 쿠팡 파트너스 제휴 링크 사용 방식과 가격 정보 안내 기준을 설명합니다.",
  title: "제휴 고지",
};

export default function AffiliateDisclosurePage() {
  return (
    <main className="flex-1 bg-slate-50 px-4 py-12 text-slate-950">
      <article className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold text-emerald-700">Affiliate Disclosure</p>
        <h1 className="mt-2 text-3xl font-bold">쿠팡 파트너스 제휴 고지</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-600">
          <p>
            페어프라이스의 상품 링크 중 일부는 쿠팡 파트너스 활동을 통해 생성된 제휴
            링크입니다. 사용자가 해당 링크를 통해 쿠팡으로 이동하거나 상품을 구매하는 경우
            페어프라이스는 일정액의 수수료를 제공받을 수 있습니다.
          </p>
          <p>
            제휴 수수료는 사용자의 구매 가격에 별도로 추가되지 않습니다. 상품 가격, 할인율,
            배송 조건, 재고 여부는 쿠팡 판매 페이지의 실제 표시 내용을 기준으로 최종 확인해야
            합니다.
          </p>
          <p>
            페어프라이스는 가격 추적과 특가 알림을 돕기 위한 정보 서비스를 제공하며, 상품의
            판매자 또는 구매 계약의 당사자가 아닙니다.
          </p>
        </div>
      </article>
    </main>
  );
}
