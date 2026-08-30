import assert from "node:assert/strict";
import {
  normalizePushSubscription,
  PUSH_SUBSCRIPTION_ERROR_MESSAGES,
} from "../src/lib/push-subscription.ts";

const valid = {
  auth: "auth-secret",
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keyword: "물티슈",
  p256dh: "public-key",
};

// A well-formed keyword subscription.
const ok = normalizePushSubscription(valid);
assert.equal(ok.error, null);
assert.equal(ok.subscription.endpoint, "https://fcm.googleapis.com/fcm/send/abc123");
assert.equal(ok.subscription.keyword, "물티슈");
assert.equal(ok.subscription.productSlug, null);
assert.equal(ok.subscription.maxPrice, null);

// A product subscription needs no keyword.
const product = normalizePushSubscription({
  ...valid,
  keyword: undefined,
  productSlug: "coupang-123-item-vendor",
});
assert.equal(product.error, null);
assert.equal(product.subscription.productSlug, "coupang-123-item-vendor");

// The endpoint is a URL the server will later send requests to, so anything
// that is not https must be refused rather than stored.
for (const endpoint of [
  "http://fcm.googleapis.com/fcm/send/abc",
  "javascript:alert(1)",
  "file:///etc/passwd",
  "not a url",
  "",
  undefined,
  12345,
]) {
  assert.equal(
    normalizePushSubscription({ ...valid, endpoint }).error,
    "invalid-endpoint",
    `endpoint ${String(endpoint)} must be rejected`,
  );
}

// Both encryption keys are required.
assert.equal(normalizePushSubscription({ ...valid, p256dh: "" }).error, "invalid-keys");
assert.equal(normalizePushSubscription({ ...valid, auth: undefined }).error, "invalid-keys");

// A subscription with nothing to watch would match every deal.
assert.equal(
  normalizePushSubscription({ ...valid, keyword: "   ", productSlug: "" }).error,
  "no-target",
);

// Target price bounds.
assert.equal(normalizePushSubscription({ ...valid, maxPrice: 0 }).error, "invalid-max-price");
assert.equal(normalizePushSubscription({ ...valid, maxPrice: -5 }).error, "invalid-max-price");
assert.equal(normalizePushSubscription({ ...valid, maxPrice: "abc" }).error, "invalid-max-price");
assert.equal(
  normalizePushSubscription({ ...valid, maxPrice: 999_999_999 }).error,
  "invalid-max-price",
);

// An omitted or blank price is simply absent, not invalid.
assert.equal(normalizePushSubscription({ ...valid, maxPrice: "" }).subscription.maxPrice, null);
assert.equal(normalizePushSubscription({ ...valid, maxPrice: null }).subscription.maxPrice, null);

// A numeric string from a form body is accepted and floored.
assert.equal(
  normalizePushSubscription({ ...valid, maxPrice: "10900.7" }).subscription.maxPrice,
  10900,
);

// Keywords are collapsed and bounded so one subscriber cannot store an essay.
const messy = normalizePushSubscription({ ...valid, keyword: "  무선   이어폰  " });
assert.equal(messy.subscription.keyword, "무선 이어폰");
assert.ok(
  normalizePushSubscription({ ...valid, keyword: "가".repeat(200) }).subscription.keyword
    .length <= 60,
);

// Every error code has a message the UI can show.
for (const code of ["invalid-endpoint", "invalid-keys", "invalid-max-price", "no-target"]) {
  assert.ok(PUSH_SUBSCRIPTION_ERROR_MESSAGES[code]);
}

console.log("Push subscription tests passed.");
