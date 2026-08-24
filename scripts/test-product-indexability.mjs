import assert from "node:assert/strict";
import {
  getProductSeoEligibility,
  PRODUCT_SEO_MAX_AGE_MS,
} from "../src/lib/seo/product-indexability.ts";

const now = new Date("2026-08-24T00:00:00.000Z");
const eligibleProduct = {
  imageUrl: "https://example.com/product.jpg",
  lastCheckedAt: new Date(now.getTime() - 60 * 60 * 1000),
  observedSamples: 3,
  price: 15900,
  source: "database",
  title: "충분한 정보를 가진 테스트 상품",
};

assert.deepEqual(getProductSeoEligibility(eligibleProduct, now), {
  eligible: true,
  reasons: [],
});

const thinProduct = getProductSeoEligibility(
  {
    ...eligibleProduct,
    imageUrl: null,
    observedSamples: 1,
    source: "sample",
  },
  now,
);
assert.equal(thinProduct.eligible, false);
assert.deepEqual(thinProduct.reasons, [
  "sample-product",
  "missing-image",
  "thin-history",
]);

const staleProduct = getProductSeoEligibility(
  {
    ...eligibleProduct,
    lastCheckedAt: new Date(now.getTime() - PRODUCT_SEO_MAX_AGE_MS - 1),
  },
  now,
);
assert.equal(staleProduct.eligible, false);
assert.deepEqual(staleProduct.reasons, ["stale-price"]);

console.log("Product SEO indexability tests passed.");
