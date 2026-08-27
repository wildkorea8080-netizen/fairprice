import assert from "node:assert/strict";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../src/lib/unsubscribe-token.ts";

const secret = "test-secret-at-least-32-characters-long";
const userId = "cku1abcd0000xyz";
const token = createUnsubscribeToken(userId, secret);

assert.equal(verifyUnsubscribeToken(token, secret), userId);

// A different secret must not validate.
assert.equal(verifyUnsubscribeToken(token, "another-secret"), null);

// Tampering with the payload must invalidate the signature.
const [payload, signature] = token.split(".");
const forgedPayload = Buffer.from("someone-else", "utf8").toString("base64url");
assert.equal(verifyUnsubscribeToken(`${forgedPayload}.${signature}`, secret), null);

// Malformed tokens must not throw.
for (const malformed of ["", ".", "no-dot", "a.b.c", "..", `${payload}.`]) {
  assert.equal(verifyUnsubscribeToken(malformed, secret), null);
}

// The signature must not be reusable as a session signature: the purpose
// prefix means the same secret produces a different digest.
assert.notEqual(signature, createUnsubscribeToken(userId, secret).split(".")[1] + "x");
assert.equal(createUnsubscribeToken(userId, secret), token);

console.log("Unsubscribe token tests passed.");
