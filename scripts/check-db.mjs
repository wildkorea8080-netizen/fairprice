import { readFileSync } from "node:fs";
import { Client } from "pg";

const DEFAULT_DATABASE_URL =
  "postgresql://fairprice:fairprice_local_dev@localhost:5432/fairprice?schema=public";

function parseEnvFile(path) {
  try {
    const contents = readFileSync(path, "utf8");
    const entries = {};

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex < 1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, "");

      entries[key] = value;
    }

    return entries;
  } catch {
    return {};
  }
}

async function main() {
  const env = {
    ...parseEnvFile(".env.local"),
    ...process.env,
  };
  const databaseUrl = env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const result = await client.query(
      "select current_database() as database, current_user as user_name, version() as version",
    );
    const row = result.rows[0];

    console.log("Database connection: PASS");
    console.log(`Database: ${row.database}`);
    console.log(`User: ${row.user_name}`);
    console.log(`Version: ${row.version.split(",")[0]}`);
  } catch (error) {
    console.log("Database connection: FAIL");
    if (error instanceof Error) {
      console.log(error.message || error.name);
      if ("code" in error && error.code) {
        console.log(`Code: ${error.code}`);
      }
    } else {
      console.log("Unknown database connection error");
    }
    console.log("Run `npm run db:up` and verify DATABASE_URL in .env.local.");
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
