import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_ENV_FILE = ".env.production";

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

function buildRestoreArgs({ clean, databaseUrl, inputPath, jobs }) {
  const restoreArgs = [
    "--no-owner",
    "--no-acl",
    "--dbname",
    databaseUrl,
  ];

  if (clean) {
    restoreArgs.push("--clean", "--if-exists");
  }

  if (jobs) {
    restoreArgs.push("--jobs", jobs);
  }

  restoreArgs.push(inputPath);

  return restoreArgs;
}

function maskDatabaseUrl(value) {
  return value.replace(/\/\/.*@/, "//***@");
}

function maskRestoreArgs(args) {
  return args.map((arg, index) =>
    args[index - 1] === "--dbname" ? "<DATABASE_URL>" : arg,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = resolve(process.cwd(), args.envFile || DEFAULT_ENV_FILE);
  const inputPath = args.file ? resolve(process.cwd(), args.file) : "";
  const env = {
    ...parseEnvFile(envFile),
    ...process.env,
  };
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is required in ${envFile} or the environment.`);
  }

  if (!inputPath || !existsSync(inputPath)) {
    throw new Error("A valid backup file is required. Pass --file=/path/to/file.dump.");
  }

  const restoreArgs = buildRestoreArgs({
    clean: args.clean === "true",
    databaseUrl,
    inputPath,
    jobs: args.jobs,
  });

  console.log(`Restore target: ${maskDatabaseUrl(databaseUrl)}`);
  console.log(`Restore file: ${inputPath}`);
  console.log(`Command: pg_restore ${maskRestoreArgs(restoreArgs).join(" ")}`);

  if (args.confirm !== "RESTORE") {
    console.log("Dry run only. Re-run with --confirm=RESTORE to execute.");
    return;
  }

  await run("pg_restore", restoreArgs, env);
  console.log("Restore completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
