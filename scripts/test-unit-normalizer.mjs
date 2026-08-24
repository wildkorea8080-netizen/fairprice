import assert from "node:assert/strict";
import { normalizeProductUnit } from "../src/lib/catalog/unit-normalizer.ts";

assert.deepEqual(normalizeProductUnit("아기 물티슈 100매, 20개"), {
  packCount: 20,
  unitLabel: "매",
  unitQuantity: 2_000,
});
assert.deepEqual(normalizeProductUnit("생수 500ml 24개"), {
  packCount: 24,
  unitLabel: "ml",
  unitQuantity: 12_000,
});
assert.deepEqual(normalizeProductUnit("세탁세제 3L 2개"), {
  packCount: 2,
  unitLabel: "ml",
  unitQuantity: 6_000,
});
assert.deepEqual(normalizeProductUnit("견과류 1.2kg 3팩"), {
  packCount: 3,
  unitLabel: "g",
  unitQuantity: 3_600,
});
assert.deepEqual(normalizeProductUnit("비타민 60정 2개"), {
  packCount: 2,
  unitLabel: "정",
  unitQuantity: 120,
});
assert.deepEqual(normalizeProductUnit("마스크 50개입"), {
  packCount: 1,
  unitLabel: "개",
  unitQuantity: 50,
});
assert.deepEqual(normalizeProductUnit("커피 원액 1개, 1개입, 1L"), {
  packCount: 1,
  unitLabel: "ml",
  unitQuantity: 1_000,
});
assert.deepEqual(normalizeProductUnit("커피믹스 900g, 12개입, 1박스"), {
  packCount: 12,
  unitLabel: "g",
  unitQuantity: 10_800,
});
assert.deepEqual(normalizeProductUnit("스틱커피 2g, 100개입, 1개"), {
  packCount: 1,
  unitLabel: "개",
  unitQuantity: 100,
});
assert.deepEqual(normalizeProductUnit("물티슈 230g, 100매, 20개"), {
  packCount: 20,
  unitLabel: "매",
  unitQuantity: 2_000,
});
assert.equal(normalizeProductUnit("아이폰 16 프로 256GB"), null);
assert.equal(normalizeProductUnit("브라운 시리즈9 면도날 94M 96M"), null);

console.log("Product unit normalizer tests passed.");
