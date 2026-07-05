import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash?: string | null) {
  if (!passwordHash) {
    return false;
  }

  const [algorithm, salt, storedKey] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(storedKey, "base64url");

  if (derivedKey.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedBuffer);
}
