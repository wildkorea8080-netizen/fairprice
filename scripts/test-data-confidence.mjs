import assert from "node:assert/strict";
import {
  calculateDataConfidence,
  getDataConfidenceProgress,
} from "../src/modules/deal-engine/domain/data-confidence.ts";

assert.equal(calculateDataConfidence(4, 30), "COLLECTING");
assert.equal(calculateDataConfidence(20, 6), "COLLECTING");
assert.equal(calculateDataConfidence(5, 7), "PRELIMINARY");
assert.equal(calculateDataConfidence(20, 29), "PRELIMINARY");
assert.equal(calculateDataConfidence(20, 30), "RELIABLE");

assert.deepEqual(getDataConfidenceProgress("COLLECTING", 2, 3), {
  nextConfidence: "PRELIMINARY",
  progressPercent: 40,
  remainingDays: 4,
  remainingSamples: 3,
  targetDays: 7,
  targetSamples: 5,
});
assert.equal(
  getDataConfidenceProgress("PRELIMINARY", 10, 20).progressPercent,
  50,
);
assert.equal(getDataConfidenceProgress("RELIABLE", 20, 30).progressPercent, 100);

console.log("Data confidence tests passed.");
