const ignoredTokens = new Set([
  "구성",
  "국내산",
  "대용량",
  "단품",
  "리뉴얼",
  "묶음",
  "본품",
  "수입산",
  "세트",
  "오리지널",
  "정품",
  "증정",
  "패키지",
  "플러스",
  "프리미엄",
]);

export function getComparableTitleTokens(title: string) {
  return new Set(
    title
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .match(/[\p{L}]{2,}/gu)
      ?.filter((token) => !ignoredTokens.has(token)) ?? [],
  );
}

export function getProductTitleSimilarity(firstTitle: string, secondTitle: string) {
  const firstTokens = getComparableTitleTokens(firstTitle);
  const secondTokens = getComparableTitleTokens(secondTitle);

  if (firstTokens.size === 0 || secondTokens.size === 0) return 0;

  const commonTokenCount = [...firstTokens].filter((token) => secondTokens.has(token)).length;

  return commonTokenCount / Math.min(firstTokens.size, secondTokens.size);
}

export function areProductTitlesComparable(firstTitle: string, secondTitle: string) {
  return getProductTitleSimilarity(firstTitle, secondTitle) >= 0.25;
}
