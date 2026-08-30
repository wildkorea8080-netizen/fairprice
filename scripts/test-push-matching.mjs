import assert from "node:assert/strict";
import { matchesKeyword, shouldPushDeal } from "../src/lib/push-matching.ts";

const deal = {
  price: 9900,
  productId: "prod-1",
  title: "코멧 오리지널 아기물티슈 캡형 100매",
};

// Product subscriptions are exact.
assert.equal(
  shouldPushDeal({ keyword: null, maxPrice: null, productId: "prod-1" }, deal),
  true,
);
assert.equal(
  shouldPushDeal({ keyword: null, maxPrice: null, productId: "prod-2" }, deal),
  false,
);

// Keyword subscriptions match on the product title.
assert.equal(
  shouldPushDeal({ keyword: "물티슈", maxPrice: null, productId: null }, deal),
  true,
);
assert.equal(
  shouldPushDeal({ keyword: "커피", maxPrice: null, productId: null }, deal),
  false,
);

// The target price is a ceiling. One push above it is enough to lose the
// permission for every later one.
assert.equal(
  shouldPushDeal({ keyword: "물티슈", maxPrice: 9900, productId: null }, deal),
  true,
  "a deal exactly at the ceiling qualifies",
);
assert.equal(
  shouldPushDeal({ keyword: "물티슈", maxPrice: 9000, productId: null }, deal),
  false,
);
assert.equal(
  shouldPushDeal({ keyword: null, maxPrice: 9000, productId: "prod-1" }, deal),
  false,
  "the ceiling applies to product subscriptions too",
);

// A subscription naming nothing must never match - normalization refuses to
// create one, and this is the second line of defence.
assert.equal(
  shouldPushDeal({ keyword: null, maxPrice: null, productId: null }, deal),
  false,
);

// Every term must appear, so a multi-word keyword cannot match on one word.
assert.equal(matchesKeyword("무선 이어폰 블루투스", "무선 이어폰"), true);
assert.equal(matchesKeyword("무선 전기주전자", "무선 이어폰"), false);

// Terms match as substrings, not whole words, because Korean product titles
// space compounds inconsistently. Someone subscribing to "아기 물티슈" wants
// "아기물티슈" listings, and requiring a space would drop most of them.
assert.equal(matchesKeyword("코멧 아기물티슈", "아기 물티슈"), true);
assert.equal(matchesKeyword("코멧 아기물티슈", "성인 물티슈"), false);

// Matching ignores case for latin text.
assert.equal(matchesKeyword("Apple AirPods Pro", "airpods"), true);
assert.equal(matchesKeyword("Apple AirPods Pro", "AIRPODS PRO"), true);

// An empty keyword matches nothing rather than everything.
assert.equal(matchesKeyword("아무 상품", ""), false);
assert.equal(matchesKeyword("아무 상품", "   "), false);

console.log("Push matching tests passed.");
