import assert from "node:assert/strict";
import {
  getKeywordSeoEligibility,
} from "../src/lib/seo/keyword-indexability.ts";

// A keyword with products qualifies.
const ok = getKeywordSeoEligibility({ keyword: "물티슈", productCount: 12 });
assert.equal(ok.eligible, true);
assert.deepEqual(ok.reasons, []);

// One product is enough - the page has something real to show.
assert.equal(
  getKeywordSeoEligibility({ keyword: "물티슈", productCount: 1 }).eligible,
  true,
);

// Zero products is the case this gate exists for.
const empty = getKeywordSeoEligibility({
  keyword: "티스 오프 클렌징",
  productCount: 0,
});
assert.equal(empty.eligible, false);
assert.deepEqual(empty.reasons, ["no-products"]);

// A one-character keyword cannot rank for anything and matches too much.
const thin = getKeywordSeoEligibility({ keyword: "커", productCount: 30 });
assert.equal(thin.eligible, false);
assert.deepEqual(thin.reasons, ["thin-keyword"]);

// Whitespace-only keywords are thin, not merely untrimmed.
assert.equal(
  getKeywordSeoEligibility({ keyword: "   ", productCount: 30 }).eligible,
  false,
);

// Both failures are reported, not just the first.
const both = getKeywordSeoEligibility({ keyword: "커", productCount: 0 });
assert.equal(both.eligible, false);
assert.deepEqual(both.reasons, ["thin-keyword", "no-products"]);

// Surrounding whitespace must not decide eligibility on its own.
assert.equal(
  getKeywordSeoEligibility({ keyword: "  물티슈  ", productCount: 5 }).eligible,
  true,
);

console.log("Keyword indexability tests passed.");
