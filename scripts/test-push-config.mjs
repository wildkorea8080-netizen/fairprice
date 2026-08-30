import assert from "node:assert/strict";
import { getVapidConfig, getVapidPublicKey } from "../src/lib/push-config.ts";

const full = {
  FAIRPRICE_CONTACT_EMAIL: "contact@fairprice.kr",
  VAPID_PRIVATE_KEY: "private",
  VAPID_PUBLIC_KEY: "public",
};

// A complete configuration, with the contact turned into a mailto: subject.
const ok = getVapidConfig(full);
assert.deepEqual(ok, {
  privateKey: "private",
  publicKey: "public",
  subject: "mailto:contact@fairprice.kr",
});
assert.equal(getVapidPublicKey(full), "public");

// An address that already carries a scheme is left alone.
assert.equal(
  getVapidConfig({ ...full, FAIRPRICE_CONTACT_EMAIL: "mailto:a@b.kr" }).subject,
  "mailto:a@b.kr",
);
assert.equal(
  getVapidConfig({ ...full, FAIRPRICE_CONTACT_EMAIL: "https://fairprice.kr" }).subject,
  "https://fairprice.kr",
);

// Any missing piece disables push entirely - a subscribe button that fails
// when pressed is worse than no button.
assert.equal(getVapidConfig({ ...full, VAPID_PUBLIC_KEY: undefined }), null);
assert.equal(getVapidConfig({ ...full, VAPID_PRIVATE_KEY: "" }), null);
assert.equal(getVapidConfig({ ...full, FAIRPRICE_CONTACT_EMAIL: "  " }), null);
assert.equal(getVapidConfig({}), null);
assert.equal(getVapidPublicKey({}), null);

// Whitespace must not defeat the check.
assert.equal(
  getVapidConfig({ ...full, VAPID_PUBLIC_KEY: "  public  " }).publicKey,
  "public",
);

console.log("Push config tests passed.");
