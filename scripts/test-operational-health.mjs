import assert from "node:assert/strict";
import {
  assessReliability,
  formatFailureRate,
  getFailureRate,
  isReliabilityHealthy,
} from "../src/lib/operational-health.ts";

const quiet = { failed: 0, total: 0 };

// Failure rate basics.
assert.equal(getFailureRate({ failed: 0, total: 0 }), null);
assert.equal(getFailureRate({ failed: 1, total: 4 }), 0.25);
// Counts must never produce a rate above 1 or below 0.
assert.equal(getFailureRate({ failed: 9, total: 4 }), 1);
assert.equal(getFailureRate({ failed: -3, total: 4 }), 0);

assert.equal(formatFailureRate(null), "-");
assert.equal(formatFailureRate(0.25), "25%");

// A window with too few samples stays "unknown" rather than reporting 100%.
assert.equal(
  assessReliability({
    collectionJobs: quiet,
    cronRuns: { failed: 1, total: 1 },
    notifications: quiet,
  }).status,
  "unknown",
);

// All green.
const healthy = assessReliability({
  collectionJobs: { failed: 0, total: 40 },
  cronRuns: { failed: 0, total: 48 },
  notifications: { failed: 0, total: 10 },
});
assert.equal(healthy.status, "healthy");
assert.deepEqual(healthy.reasons, []);

// One cron run in ten failing is degraded, not critical.
const degraded = assessReliability({
  collectionJobs: { failed: 0, total: 40 },
  cronRuns: { failed: 5, total: 48 },
  notifications: { failed: 0, total: 10 },
});
assert.equal(degraded.status, "degraded");
assert.equal(degraded.reasons.length, 1);
assert.match(degraded.reasons[0], /자동화 실행/);

// Half the collection jobs failing is critical, and the worst signal wins.
const critical = assessReliability({
  collectionJobs: { failed: 30, total: 40 },
  cronRuns: { failed: 5, total: 48 },
  notifications: { failed: 0, total: 10 },
});
assert.equal(critical.status, "critical");
assert.equal(critical.signals.collectionJobs.status, "critical");
assert.equal(critical.signals.cronRuns.status, "degraded");
assert.equal(critical.signals.notifications.status, "healthy");
assert.equal(critical.reasons.length, 2);

// Email delivery failing on its own must still surface.
const emailBroken = assessReliability({
  collectionJobs: { failed: 0, total: 40 },
  cronRuns: { failed: 0, total: 48 },
  notifications: { failed: 8, total: 10 },
});
assert.equal(emailBroken.status, "critical");
assert.match(emailBroken.reasons[0], /알림 발송/);

assert.equal(isReliabilityHealthy("healthy"), true);
assert.equal(isReliabilityHealthy("unknown"), true);
assert.equal(isReliabilityHealthy("degraded"), false);
assert.equal(isReliabilityHealthy("critical"), false);

console.log("Operational health tests passed.");
