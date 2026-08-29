import assert from "node:assert/strict";
import {
  estimateDailyRefreshDemand,
  getTrackingIntervalMinutes,
  getTrackingTierByRank,
  TRACKING_TIER_INTERVAL_MINUTES,
} from "../src/modules/deal-engine/domain/tracking-tiers.ts";

// Rank boundaries, 1-based.
assert.equal(getTrackingTierByRank(1), "A");
assert.equal(getTrackingTierByRank(100), "A");
assert.equal(getTrackingTierByRank(101), "B");
assert.equal(getTrackingTierByRank(300), "B");
assert.equal(getTrackingTierByRank(301), "C");
assert.equal(getTrackingTierByRank(1000), "C");
assert.equal(getTrackingTierByRank(1001), "D");
assert.equal(getTrackingTierByRank(50_000), "D");

// The top 300 must be able to reach RELIABLE: 20 samples over 30 days needs
// at least one observation a day.
const DAY = 24 * 60;
assert.ok(TRACKING_TIER_INTERVAL_MINUTES.A <= DAY, "tier A must observe daily+");
assert.ok(TRACKING_TIER_INTERVAL_MINUTES.B <= DAY, "tier B must observe daily+");

// C is deliberately a maintenance cadence that cannot reach RELIABLE - that
// is the demotion the depth-over-breadth plan calls for.
assert.ok(TRACKING_TIER_INTERVAL_MINUTES.C > DAY);
assert.ok(TRACKING_TIER_INTERVAL_MINUTES.D >= TRACKING_TIER_INTERVAL_MINUTES.C);

assert.equal(getTrackingIntervalMinutes("A"), TRACKING_TIER_INTERVAL_MINUTES.A);

// Budget guard: at the current catalog size (~1,300) the design must stay
// within a conservative Coupang API allowance. Each refresh is one search
// call; the 30-minute pipeline gives 48 runs a day, so a 25-per-run budget
// serves 1,200 checks. The demand estimate must fit under that with headroom,
// and a much larger catalog must not blow past it either - D absorbs growth.
assert.ok(
  estimateDailyRefreshDemand(1_300) <= 1_200,
  `demand ${estimateDailyRefreshDemand(1_300)} exceeds the 1,200/day refresh budget`,
);
assert.ok(
  estimateDailyRefreshDemand(5_000) <= 1_800,
  "a 5,000-product catalog must degrade gracefully, not multiply API calls",
);

console.log("Tracking tier tests passed.");
