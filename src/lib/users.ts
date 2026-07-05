import "server-only";

import type { AuthUser } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

function toDatabaseRole(role: AuthUser["role"]) {
  return role === "admin" ? "ADMIN" : "USER";
}

export async function ensureDatabaseUser(user: AuthUser) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.user.upsert({
    create: {
      email: user.email,
      name: user.name,
      role: toDatabaseRole(user.role),
    },
    update: {
      name: user.name,
      role: toDatabaseRole(user.role),
    },
    where: { email: user.email },
  });
}

export async function createDatabaseUserWithPassword({
  email,
  name,
  passwordHash,
  role,
}: AuthUser & { passwordHash: string }) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: toDatabaseRole(role),
    },
  });
}

export async function getDatabaseUserByEmail(email: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email },
  });
}
