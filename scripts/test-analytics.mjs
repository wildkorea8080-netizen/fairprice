import assert from "node:assert/strict";
import { getAnalyticsConfig } from "../src/lib/analytics.ts";

// Fully configured.
const ok = getAnalyticsConfig({
  UMAMI_SCRIPT_URL: "https://analytics.fairprice.kr/script.js",
  UMAMI_WEBSITE_ID: "abc-123",
});
assert.deepEqual(ok, {
  scriptUrl: "https://analytics.fairprice.kr/script.js",
  websiteId: "abc-123",
});

// Whitespace around values must not defeat the check.
assert.deepEqual(
  getAnalyticsConfig({
    UMAMI_SCRIPT_URL: "  https://analytics.fairprice.kr/script.js  ",
    UMAMI_WEBSITE_ID: "  abc-123  ",
  }),
  { scriptUrl: "https://analytics.fairprice.kr/script.js", websiteId: "abc-123" },
);

// Half-configured renders nothing rather than a broken tag.
assert.equal(getAnalyticsConfig({ UMAMI_SCRIPT_URL: "https://a.example/s.js" }), null);
assert.equal(getAnalyticsConfig({ UMAMI_WEBSITE_ID: "abc-123" }), null);
assert.equal(getAnalyticsConfig({}), null);
assert.equal(
  getAnalyticsConfig({ UMAMI_SCRIPT_URL: "   ", UMAMI_WEBSITE_ID: "abc" }),
  null,
);

// A malformed or non-http URL must not reach a script src.
assert.equal(
  getAnalyticsConfig({ UMAMI_SCRIPT_URL: "not a url", UMAMI_WEBSITE_ID: "abc" }),
  null,
);
assert.equal(
  getAnalyticsConfig({
    UMAMI_SCRIPT_URL: "javascript:alert(1)",
    UMAMI_WEBSITE_ID: "abc",
  }),
  null,
);
assert.equal(
  getAnalyticsConfig({ UMAMI_SCRIPT_URL: "ftp://a.example/s.js", UMAMI_WEBSITE_ID: "abc" }),
  null,
);

// http is allowed so a local Umami can be tested before TLS is in front of it.
assert.ok(
  getAnalyticsConfig({
    UMAMI_SCRIPT_URL: "http://localhost:3001/script.js",
    UMAMI_WEBSITE_ID: "abc",
  }),
);

console.log("Analytics config tests passed.");
