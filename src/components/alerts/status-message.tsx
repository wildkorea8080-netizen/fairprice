const messages: Record<string, string> = {
  "database-required": "상품 가격 알림은 데이터베이스 연결이 필요합니다.",
  "favorite-added": "관심 상품에 추가했습니다.",
  "favorite-removed": "관심 상품에서 제거했습니다.",
  "keyword-added": "키워드 알림 조건을 추가했습니다.",
  "keyword-invalid": "키워드를 입력해 주세요.",
  "keyword-removed": "키워드 알림 조건을 삭제했습니다.",
  "notification-empty": "새로 발송할 매칭 상품이 없습니다.",
  "notification-sent": "매칭 상품 테스트 이메일을 발송 대기열에 기록했습니다.",
  "product-alert-added": "상품 가격 알림을 등록했습니다.",
  "product-alert-invalid": "목표가 또는 최소 할인율 중 하나를 입력해 주세요.",
  "product-alert-missing": "알림을 등록할 상품을 찾지 못했습니다.",
  "product-alert-removed": "상품 가격 알림을 삭제했습니다.",
};

export function AlertStatusMessage({ status }: { status?: string }) {
  if (!status || !messages[status]) {
    return null;
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
      {messages[status]}
    </div>
  );
}
