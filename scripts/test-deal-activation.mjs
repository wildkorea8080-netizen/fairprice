import assert from "node:assert/strict";
import { getDealActivationTier } from "../src/modules/deal-engine/domain/deal-activation.ts";

const thresholds = { candidateThreshold: 80, confirmedThreshold: 90 };

// COLLECTING never activates, no matter the score.
assert.equal(
  getDealActivationTier({ ...thresholds, confidence: "COLLECTING", score: 100 }),
  null,
);

// RELIABLE at the special threshold is a confirmed deal.
assert.equal(
  getDealActivationTier({ ...thresholds, confidence: "RELIABLE", score: 90 }),
  "CONFIRMED",
);

// RELIABLE below special but at the deal threshold is still a candidate.
assert.equal(
  getDealActivationTier({ ...thresholds, confidence: "RELIABLE", score: 85 }),
  "CANDIDATE",
);

// The case the old rule made impossible: PRELIMINARY caps at 89, and the old
// activation required 90. A strong PRELIMINARY deal must now surface.
assert.equal(
  getDealActivationTier({ ...thresholds, confidence: "PRELIMINARY", score: 89 }),
  "CANDIDATE",
);
assert.equal(
  getDealActivationTier({ ...thresholds, confidence: "PRELIMINARY", score: 80 }),
  "CANDIDATE",
);

// PRELIMINARY can never be CONFIRMED even at a perfect score.
assert.notEqual(
  getDealActivationTier({ ...thresholds, confidence: "PRELIMINARY", score: 100 }),
  "CONFIRMED",
);

// Below the candidate threshold nothing activates.
assert.equal(
  getDealActivationTier({ ...thresholds, confidence: "PRELIMINARY", score: 79 }),
  null,
);
assert.equal(
  getDealActivationTier({ ...thresholds, confidence: "RELIABLE", score: 79 }),
  null,
);

console.log("Deal activation tests passed.");
