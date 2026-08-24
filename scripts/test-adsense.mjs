import assert from "node:assert/strict";
import {
  createAdsTxtRecord,
  normalizeAdsensePublisherId,
} from "../src/lib/adsense.ts";

assert.equal(normalizeAdsensePublisherId("pub-1234567890123456"), "pub-1234567890123456");
assert.equal(normalizeAdsensePublisherId(" ca-pub-1234567890123456 "), "pub-1234567890123456");
assert.equal(normalizeAdsensePublisherId("pub-not-a-number"), null);
assert.equal(normalizeAdsensePublisherId(""), null);
assert.equal(
  createAdsTxtRecord("pub-1234567890123456"),
  "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
);

console.log("AdSense ads.txt tests passed.");
