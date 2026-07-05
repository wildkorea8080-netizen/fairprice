import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_ENV_FILE = ".env.production";
const DEFAULT_BACKUP_DIR = "backups";

function parseArgs(argv) {
  const options = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, value = "true"] = arg.slice(2).split("=");
    options[key] = value;
  }

  return options;
}

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

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = resolve(process.cwd(), args.envFile || DEFAULT_ENV_FILE);
  const backupDir = resolve(process.cwd(), args.outputDir || DEFAULT_BACKUP_DIR);
  const env = {
    ...parseEnvFile(envFile),
    ...process.env,
  };
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is required in ${envFile} or the environment.`);
  }

  const outputPath = resolve(backupDir, `fairprice-${timestamp()}.dump`);
  mkdirSync(dirname(outputPath), { recursive: true });

  if (args.dryRun === "true") {
    console.log(`Would run pg_dump into ${outputPath}`);
    return;
  }

  console.log(`Creating PostgreSQL backup: ${outputPath}`);

  await run(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl", "--file", outputPath, databaseUrl],
    env,
  );

  console.log(`Backup completed: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
