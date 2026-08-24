import assert from "node:assert/strict";
import { detectDealEvents } from "../src/modules/deal-engine/domain/deal-detection.ts";

const checkedAt = new Date("2026-08-23T00:00:00.000Z");
const history = Array.from({ length: 12 }, (_, index) => ({
  checkedAt: new Date(checkedAt.getTime() - (index + 1) * 86_400_000),
  price: 100_000 - (index % 3) * 1_000,
}));
const events = detectDealEvents({
  averagePrice: 99_000,
  checkedAt,
  confidence: "RELIABLE",
  currentPrice: 80_000,
  history,
  previousPrice: 100_000,
  score: 94,
});
const eventTypes = new Set(events.map(({ type }) => type));

assert.equal(eventTypes.has("AVERAGE_PRICE_DROP"), true);
assert.equal(eventTypes.has("LOWEST_30D"), true);
assert.equal(eventTypes.has("LOWEST_90D"), true);
assert.equal(eventTypes.has("NEAR_ALL_TIME_LOW"), true);
assert.equal(eventTypes.has("RAPID_DROP"), true);
assert.equal(eventTypes.has("HIGH_DEAL_SCORE"), true);

const noHistoryEvents = detectDealEvents({
  averagePrice: 80_000,
  checkedAt,
  confidence: "COLLECTING",
  currentPrice: 80_000,
  history: [],
  score: 59,
});

assert.deepEqual(noHistoryEvents, []);

const configurableThresholdEvents = detectDealEvents(
  {
    averagePrice: 100_000,
    checkedAt,
    confidence: "RELIABLE",
    currentPrice: 100_000,
    history,
    score: 87,
  },
  {
    averageDropRate: 10,
    highDealScore: 85,
    nearAllTimeLowRate: 2,
    rapidDropRate: 10,
  },
);

assert.equal(
  configurableThresholdEvents.some(({ type }) => type === "HIGH_DEAL_SCORE"),
  true,
);

console.log("Deal Detection tests passed.");
