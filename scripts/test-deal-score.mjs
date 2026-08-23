import assert from "node:assert/strict";
import {
  calculateDealScore,
  DEFAULT_DEAL_SCORE_CONFIG,
  validateDealScoreConfig,
} from "../src/modules/deal-engine/domain/deal-score.ts";

validateDealScoreConfig(DEFAULT_DEAL_SCORE_CONFIG);

const reliableDeal = calculateDealScore({
  averagePrice: 100_000,
  confidence: "RELIABLE",
  currentPrice: 70_000,
  historicalPercentile: 0,
  lowestPrice: 70_000,
  previousPrice: 90_000,
  sampleCount: 30,
});

assert.equal(reliableDeal.score, 100);
assert.equal(reliableDeal.band, "LEGENDARY");
assert.equal(
  Object.values(reliableDeal.components).reduce((sum, value) => sum + value, 0),
  reliableDeal.rawScore,
);

const collectingDeal = calculateDealScore({
  averagePrice: 100_000,
  confidence: "COLLECTING",
  currentPrice: 50_000,
  historicalPercentile: 0,
  lowestPrice: 50_000,
  previousPrice: 100_000,
  sampleCount: 2,
});

assert.equal(collectingDeal.score, 59);
assert.equal(collectingDeal.band, "GENERAL");

assert.throws(() =>
  validateDealScoreConfig({
    ...DEFAULT_DEAL_SCORE_CONFIG,
    weights: { ...DEFAULT_DEAL_SCORE_CONFIG.weights, averageDrop: 34 },
  }),
);

console.log("Deal Score V1 tests passed.");
