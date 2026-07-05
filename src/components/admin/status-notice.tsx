const messages: Record<string, string> = {
  created: "상품 등록 액션이 처리되었습니다.",
  "database-required": "PostgreSQL 연결이 필요합니다.",
  featured: "추천 상품으로 표시했습니다.",
  hidden: "상품을 숨김 처리했습니다. 사용자 특가 목록에서 제외됩니다.",
  "note-failed": "운영 메모를 저장할 상품 또는 관리자 계정을 찾지 못했습니다.",
  "note-required": "운영 메모 내용을 입력해 주세요.",
  "note-saved": "운영 메모를 저장했습니다.",
  restored: "상품을 다시 활성화했습니다.",
  saved: "카테고리 저장 액션이 처리되었습니다.",
  unfeatured: "추천 상품 표시를 해제했습니다.",
  updated: "상품 수정 액션이 처리되었습니다.",
};

export function StatusNotice({ status }: { status?: string }) {
  if (!status || !messages[status]) {
    return null;
  }

  return (
    <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
      {messages[status]}
    </div>
  );
}
