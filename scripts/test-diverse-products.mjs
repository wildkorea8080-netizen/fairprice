import assert from "node:assert/strict";
import {
  createProductDedupeSet,
  selectDiverseProducts,
} from "../src/lib/catalog/diverse-products.ts";

const product = (slug, title, category) => ({ category: { slug: category }, slug, title });

const products = [
  product("food-1", "오뚜기 육개장 컵 104g", "food"),
  product("food-2", "오뚜기 육개장 컵 86g", "food"),
  product("digital-1", "삼성 무선 이어폰 블랙", "digital"),
  product("life-1", "세타필 모이스춰라이징 로션 591ml", "life"),
  product("digital-2", "로지텍 무선 마우스", "digital"),
  product("food-3", "동원 참치 라이트", "food"),
];

const selected = selectDiverseProducts({ limit: 5, products });
assert.deepEqual(
  selected.map(({ slug }) => slug),
  ["food-1", "digital-1", "life-1", "food-3", "digital-2"],
  "상품군 중복을 제거하고 카테고리를 순환해야 합니다.",
);

const excluded = createProductDedupeSet([products[0]]);
const withoutExcludedFamily = selectDiverseProducts({ excludedKeys: excluded, limit: 5, products });
assert.equal(withoutExcludedFamily.some(({ slug }) => slug === "food-2"), false);

console.log("diverse product selection tests passed");
