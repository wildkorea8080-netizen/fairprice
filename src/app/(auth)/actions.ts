"use server";

import { redirect } from "next/navigation";
import {
  clearSession,
  getRoleForEmail,
  isAdminEmail,
  setSession,
  verifyAdminPassword,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/password-reset";
import {
  createDatabaseUserWithPassword,
  ensureDatabaseUser,
  getDatabaseUserByEmail,
} from "@/lib/users";

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value: FormDataEntryValue | null, email: string) {
  const name = String(value ?? "").trim();
  return name || email.split("@")[0] || "Fairprice user";
}

function getNextPath(value: FormDataEntryValue | null) {
  const next = String(value ?? "/").trim();
  return next.startsWith("/") ? next : "/";
}

export async function login(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const next = getNextPath(formData.get("next"));

  if (!email || password.length < 8) {
    redirect(`/login?status=invalid&next=${encodeURIComponent(next)}`);
  }

  const role = getRoleForEmail(email);
  const user = {
    email,
    name: normalizeName(formData.get("name"), email),
    role,
  };

  if (role === "admin") {
    if (!verifyAdminPassword(password)) {
      redirect(`/login?status=invalid&next=${encodeURIComponent(next)}`);
    }

    await ensureDatabaseUser(user);
    await setSession(user);
    redirect(next);
  }

  const databaseUser = await getDatabaseUserByEmail(email);

  if (!databaseUser || !(await verifyPassword(password, databaseUser.passwordHash))) {
    redirect(`/login?status=invalid&next=${encodeURIComponent(next)}`);
  }

  await setSession(user);

  redirect(next);
}

export async function signup(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const name = normalizeName(formData.get("name"), email);

  if (!email || password.length < 8 || name.length < 2 || isAdminEmail(email)) {
    redirect("/signup?status=invalid");
  }

  const existingUser = await getDatabaseUserByEmail(email);

  if (existingUser) {
    redirect("/signup?status=exists");
  }

  const user = {
    email,
    name,
    role: getRoleForEmail(email),
  };

  const createdUser = await createDatabaseUserWithPassword({
    ...user,
    passwordHash: await hashPassword(password),
  });

  if (!createdUser) {
    redirect("/signup?status=database-required");
  }

  await setSession(user);

  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    redirect("/forgot-password?status=invalid");
  }

  const result = await requestPasswordReset(email);
  const params = new URLSearchParams({ status: "sent" });

  if (result.resetUrl) {
    params.set("devResetUrl", result.resetUrl);
  }

  redirect(`/forgot-password?${params.toString()}`);
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!token || password.length < 8 || password !== passwordConfirm) {
    redirect(`/reset-password?status=invalid&token=${encodeURIComponent(token)}`);
  }

  const success = await resetPasswordWithToken(token, password);

  if (!success) {
    redirect("/reset-password?status=expired");
  }

  redirect("/login?status=password-reset");
}
