import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PURPOSE = "alert-unsubscribe";

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${TOKEN_PURPOSE}:${payload}`)
    .digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Unsubscribe links have to work from an email that is months old and without a
 * session, so the token carries the user id and never expires. The purpose
 * prefix keeps this signature from being interchangeable with the session
 * cookie, which uses the same secret.
 */
export function createUnsubscribeToken(userId: string, secret: string) {
  const payload = Buffer.from(userId, "utf8").toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature || !safeCompare(signature, sign(payload, secret))) {
    return null;
  }

  const userId = Buffer.from(payload, "base64url").toString("utf8");

  return userId.length > 0 ? userId : null;
}
