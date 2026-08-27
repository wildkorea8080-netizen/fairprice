import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  applyMigrations,
  createPrismaClient,
  getTestDatabaseUrl,
  resetDatabase,
} from "./db.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const databaseUrl = getTestDatabaseUrl();

if (!databaseUrl) {
  console.log("SKIPPED  integration tests: TEST_DATABASE_URL is not set.");
  console.log("");
  console.log("  Start a throwaway database and point the tests at it:");
  console.log("    npm run db:up");
  console.log(
    "    TEST_DATABASE_URL=postgresql://fairprice:fairprice_local_dev@localhost:5432/fairprice_test npm run test:integration",
  );
  console.log("");
  console.log("  CI always sets it, so these run on every push.");
  process.exit(0);
}

if (databaseUrl === process.env.DATABASE_URL) {
  console.error(
    "TEST_DATABASE_URL must differ from DATABASE_URL. These tests truncate every table.",
  );
  process.exit(1);
}

console.log("Applying migrations to the test database...");
applyMigrations(databaseUrl);

const prisma = await createPrismaClient(databaseUrl);
const files = readdirSync(here)
  .filter((name) => name.startsWith("test-") && name.endsWith(".mjs"))
  .sort();

const failures = [];

for (const file of files) {
  const started = Date.now();

  try {
    await resetDatabase(prisma);
    // import() needs a file:// URL: a Windows path like D:\... parses as scheme 'd:'.
    const suite = await import(pathToFileURL(join(here, file)).href);

    if (typeof suite.run !== "function") {
      throw new Error(`${file} does not export run(prisma)`);
    }

    await suite.run(prisma);
    console.log(`PASS  ${file.padEnd(34)} ${Date.now() - started}ms`);
  } catch (error) {
    failures.push(file);
    console.log(`FAIL  ${file.padEnd(34)} ${Date.now() - started}ms`);
    console.log(
      String(error?.stack ?? error)
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n"),
    );
  }
}

await resetDatabase(prisma);
await prisma.$disconnect();

console.log(`\n${files.length - failures.length}/${files.length} suites passed.`);

if (failures.length > 0) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exitCode = 1;
}
