import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthRole = "admin" | "user";

export type AuthUser = {
  email: string;
  name: string;
  role: AuthRole;
};

const SESSION_COOKIE = "fairprice_session";
const DEFAULT_ADMIN_EMAIL = "admin@fairprice.local";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getAdminEmail() {
  return process.env.FAIRPRICE_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
}

function getAuthSecret() {
  return process.env.FAIRPRICE_AUTH_SECRET ?? "fairprice-local-dev-auth-secret";
}

function getAdminPassword() {
  return process.env.FAIRPRICE_ADMIN_PASSWORD ?? "";
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeSession(user: AuthUser) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ ...user, expiresAt }), "utf8").toString(
    "base64url",
  );

  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string): AuthUser | null {
  try {
    const [payload, signature] = value.split(".");

    if (!payload || !signature || !safeCompare(signature, sign(payload))) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthUser & {
      expiresAt?: number;
    };

    if (!parsed.email || !parsed.name || !parsed.role) {
      return null;
    }

    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      return null;
    }

    return {
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function getRoleForEmail(email: string): AuthRole {
  return email.toLowerCase() === getAdminEmail().toLowerCase() ? "admin" : "user";
}

export function isAdminEmail(email: string) {
  return getRoleForEmail(email) === "admin";
}

export function verifyAdminPassword(password: string) {
  const adminPassword = getAdminPassword();

  if (adminPassword.length < 12) {
    return false;
  }

  return safeCompare(password, adminPassword);
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (!session?.value) {
    return null;
  }

  return decodeSession(session.value);
}

export async function setSession(user: AuthUser) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireUser(next = "/") {
  const user = await getSession();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return user;
}

export async function requireAdmin(next = "/admin") {
  const user = await requireUser(next);

  if (user.role !== "admin") {
    redirect("/?auth=forbidden");
  }

  return user;
}

export const demoAdminEmail = DEFAULT_ADMIN_EMAIL;
