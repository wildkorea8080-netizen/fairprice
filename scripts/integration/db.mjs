import { spawnSync } from "node:child_process";

/**
 * Integration tests need a throwaway PostgreSQL. They never fall back to
 * DATABASE_URL: pointing them at a development or production database would
 * truncate it.
 */
export function getTestDatabaseUrl() {
  return process.env.TEST_DATABASE_URL?.trim() || "";
}

export function applyMigrations(databaseUrl) {
  const result = spawnSync(
    process.execPath,
    ["./node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `prisma migrate deploy failed:\n${result.stderr?.toString() ?? ""}`,
    );
  }
}

/**
 * Empties every application table between suites. Reading the table list from
 * the catalog rather than hardcoding it means a new model cannot leave rows
 * behind and make a later test pass for the wrong reason.
 */
export async function resetDatabase(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'
  `);

  if (rows.length === 0) {
    return;
  }

  const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ");

  await prisma.$executeRawUnsafe(
    `truncate table ${tables} restart identity cascade`,
  );
}

export async function createPrismaClient(databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  return new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
}
