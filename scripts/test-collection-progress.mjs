import assert from "node:assert/strict";
import { getCollectionProgress } from "../src/lib/collection-progress.ts";
import { DATA_CONFIDENCE_THRESHOLDS } from "../src/modules/deal-engine/domain/data-confidence.ts";

// Drift guard: collection-progress mirrors these rather than importing them,
// because the unit runner resolves no "@/" alias. If the domain thresholds
// move, this fails and the mirror must be updated with them.
assert.equal(DATA_CONFIDENCE_THRESHOLDS.reliable.samples, 20);
assert.equal(DATA_CONFIDENCE_THRESHOLDS.reliable.trackingDays, 30);


// Tiers A and B hold 300 products. The design aims for 400 + 400 = 800
// observations a day, so roughly 2.7 each - comfortably above the floor.
const healthy = getCollectionProgress({
  observationsLast24h: 800,
  preliminary: 22,
  prioritisedProducts: 300,
  reliable: 0,
});
assert.equal(healthy.status, "healthy");
assert.equal(healthy.observationsPerPriorityProduct, 2.67);
// 20 samples at 2.67/day is 8 days, but RELIABLE also needs 30 days of
// tracking, so the projection must not promise anything sooner.
assert.equal(healthy.projectedDaysToReliable, 30);

// Exactly one a day is the floor: still healthy, still bounded by the window.
const floor = getCollectionProgress({
  observationsLast24h: 300,
  preliminary: 0,
  prioritisedProducts: 300,
  reliable: 0,
});
assert.equal(floor.status, "healthy");
assert.equal(floor.projectedDaysToReliable, 30);

// Below one a day, twenty samples outrun the thirty-day window, so RELIABLE is
// never jointly satisfied - the case this check exists to surface.
const stalled = getCollectionProgress({
  observationsLast24h: 150,
  preliminary: 5,
  prioritisedProducts: 300,
  reliable: 0,
});
assert.equal(stalled.status, "stalled");
assert.equal(stalled.observationsPerPriorityProduct, 0.5);
assert.equal(stalled.projectedDaysToReliable, null);

// A slow rate that still clears the floor projects past the window.
const slow = getCollectionProgress({
  observationsLast24h: 330,
  preliminary: 0,
  prioritisedProducts: 300,
  reliable: 0,
});
assert.equal(slow.status, "healthy");
assert.ok(slow.projectedDaysToReliable >= 30);

// No data yet must read as unknown, not as a failure.
assert.equal(
  getCollectionProgress({
    observationsLast24h: 0,
    preliminary: 0,
    prioritisedProducts: 300,
    reliable: 0,
  }).status,
  "unknown",
);
assert.equal(
  getCollectionProgress({
    observationsLast24h: 500,
    preliminary: 0,
    prioritisedProducts: 0,
    reliable: 0,
  }).status,
  "unknown",
);

console.log("Collection progress tests passed.");
