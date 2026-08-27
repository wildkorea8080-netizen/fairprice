import assert from "node:assert/strict";
import { describePriceGap } from "../src/lib/price-gap.ts";

// Cheaper than the reference.
const below = describePriceGap(21_050, 24_250, "관측 평균가");
assert.equal(below.direction, "below");
assert.equal(below.amount, 3200);
assert.equal(below.text, "관측 평균가보다 3,200원 쌉니다");

// More expensive.
const above = describePriceGap(23_620, 22_590, "역대 최저가");
assert.equal(above.direction, "above");
assert.equal(above.amount, 1030);
assert.equal(above.text, "역대 최저가보다 1,030원 비쌉니다");

// Exactly at the reference reads as neither, not as "0원 비쌉니다".
const same = describePriceGap(20_960, 20_960, "역대 최저가");
assert.equal(same.direction, "same");
assert.equal(same.amount, 0);
assert.equal(same.text, "역대 최저가와 같습니다");

// Sub-won differences round rather than leaking decimals into the sentence.
const rounded = describePriceGap(1000.4, 1000, "평균가");
assert.equal(rounded.direction, "same");

const roundedUp = describePriceGap(1002.6, 1000, "평균가");
assert.equal(roundedUp.amount, 3);
assert.equal(roundedUp.text, "평균가보다 3원 비쌉니다");

// Thousands separators must be Korean-locale grouped.
assert.equal(
  describePriceGap(0, 1_234_567, "정가").text,
  "정가보다 1,234,567원 쌉니다",
);

// A missing reference must not render "NaN원".
const missing = describePriceGap(1000, Number.NaN, "평균가");
assert.equal(missing.direction, "same");
assert.ok(!missing.text.includes("NaN"));

console.log("Price gap tests passed.");
