import assert from "node:assert/strict";
import {
  getAlertCooldownHours,
  getAlertDeliveryDecision,
} from "../src/lib/alert-delivery-policy.ts";

const now = new Date("2026-08-24T00:00:00.000Z");

assert.equal(getAlertCooldownHours(undefined), 24);
assert.equal(getAlertCooldownHours("48"), 48);
assert.equal(getAlertCooldownHours("0"), 24);
assert.equal(getAlertCooldownHours("999"), 24);

assert.equal(getAlertDeliveryDecision({ wasConditionMet: true, cooldownHours: 24, lastTriggeredAt: null, now }), "duplicate");
assert.equal(
  getAlertDeliveryDecision({
    wasConditionMet: false,
    cooldownHours: 24,
    lastTriggeredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    now,
  }),
  "cooldown",
);
assert.equal(
  getAlertDeliveryDecision({
    wasConditionMet: false,
    cooldownHours: 24,
    lastTriggeredAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
    now,
  }),
  "notify",
);

console.log("Alert delivery policy tests passed.");
