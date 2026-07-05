import type { Metadata } from "next";
import { getLegalConfig } from "@/lib/legal-config";

export const metadata: Metadata = {
  alternates: {
    canonical: "/privacy",
  },
  description:
    "페어프라이스의 회원 정보, 관심 상품, 알림 조건, 알림 발송 기록 처리 방침을 안내합니다.",
  title: "개인정보처리방침",
};

export default function PrivacyPage() {
  const { contactEmail, operatorName } = getLegalConfig();

  return (
    <main className="flex-1 bg-slate-50 px-4 py-12 text-slate-950">
      <article className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold text-emerald-700">Privacy</p>
        <h1 className="mt-2 text-3xl font-bold">개인정보처리방침</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-600">
          <p>
            페어프라이스는 회원 식별, 관심 상품 저장, 키워드/상품 알림 조건 관리, 알림 발송
            기록 확인을 위해 필요한 최소한의 정보를 처리합니다.
          </p>
          <p>
            로그인 세션은 HTTP 전용 서명 쿠키로 보호되며, 관심 상품, 알림 조건, 가격 이력,
            알림 기록, 제휴 클릭 기록은 PostgreSQL 데이터베이스에 저장됩니다.
          </p>
          <p>
            이메일 알림을 사용하는 경우 발송 처리를 위해 이메일 주소와 알림 내용이 설정된
            거래성 이메일 발송 서비스로 전달될 수 있습니다. 운영 환경에서는 실제 이용 중인
            위탁 업체와 보관 기간을 이 방침에 반영해야 합니다.
          </p>
          <p>
            사용자는 서비스 이용 목적 달성에 필요하지 않은 정보의 삭제를 요청할 수 있으며,
            법령상 보관이 필요한 기록은 정해진 기간 동안 분리 보관될 수 있습니다.
          </p>
          <p>
            개인정보 처리 관련 문의는 {operatorName}에게 이메일{" "}
            <a className="font-bold text-emerald-700" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            로 요청할 수 있습니다.
          </p>
        </div>
      </article>
    </main>
  );
}
