import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function isNextProductionBuild() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function isDatabaseConfigured() {
  if (isNextProductionBuild()) {
    return false;
  }

  const url = process.env.DATABASE_URL?.trim();

  return Boolean(
    url &&
      /^postgres(ql)?:\/\//.test(url) &&
      !url.includes("postgres:password@localhost"),
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg(
  process.env.DATABASE_URL ??
    "postgresql://postgres:password@localhost:5432/fairprice",
);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
