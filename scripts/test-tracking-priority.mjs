import assert from "node:assert/strict";
import { getTrackingConfidenceBoost } from "../src/modules/deal-engine/domain/tracking-priority.ts";
import { getEffectiveCollectionPriority } from "../src/lib/collection-job-selection.ts";

assert.equal(getTrackingConfidenceBoost("COLLECTING"), 10);
assert.equal(getTrackingConfidenceBoost("PRELIMINARY"), 5);
assert.equal(getTrackingConfidenceBoost("RELIABLE"), 0);
assert.equal(getTrackingConfidenceBoost(null), 0);

const now = new Date("2026-08-24T12:00:00.000Z");
assert.equal(
  getEffectiveCollectionPriority(
    { categoryKey: "food", createdAt: new Date("2026-08-24T02:00:00.000Z"), priority: 20 },
    now,
  ),
  30,
);
assert.equal(
  getEffectiveCollectionPriority(
    { categoryKey: "food", createdAt: new Date("2026-08-20T00:00:00.000Z"), priority: 20 },
    now,
  ),
  50,
);

console.log("Tracking priority tests passed.");
