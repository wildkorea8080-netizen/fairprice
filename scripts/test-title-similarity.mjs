import assert from "node:assert/strict";
import {
  areProductTitlesComparable,
  getComparableTitleTokens,
  getProductTitleSimilarity,
} from "../src/lib/catalog/title-similarity.ts";

assert.deepEqual(
  [...getComparableTitleTokens("땡큐 오리지널 물티슈 100매(캡형), 230g, 20개")],
  ["땡큐", "물티슈", "캡형"],
);
assert.equal(
  areProductTitlesComparable(
    "땡큐 오리지널 물티슈 100매 캡형",
    "모나리자 내추럴 플러스 물티슈 캡형 100매",
  ),
  true,
);
assert.equal(
  areProductTitlesComparable(
    "동원 참치 라이트 스탠다드 150g",
    "농심 신라면 멀티팩 120g",
  ),
  false,
);
assert.equal(
  areProductTitlesComparable(
    "크리넥스 데코앤소프트 화장지 30롤",
    "코디 키친타월 150매",
  ),
  false,
);
assert.equal(getProductTitleSimilarity("삼다수 생수 500ml", "제주 삼다수 2L"), 0.5);

console.log("Product title similarity tests passed.");
