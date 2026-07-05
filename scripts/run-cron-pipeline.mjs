import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

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

function appendParam(searchParams, name, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  searchParams.set(name, String(value));
}

async function main() {
  const env = {
    ...parseEnvFile(resolve(process.cwd(), ".env.local")),
    ...process.env,
  };
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl || env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL;
  const secret = env.CRON_SECRET?.trim();

  if (!secret) {
    throw new Error("CRON_SECRET is required in .env.local or the environment.");
  }

  const url = new URL("/api/cron/run-pipeline", baseUrl);
  appendParam(url.searchParams, "batchSize", args.batchSize);
  appendParam(url.searchParams, "categoryId", args.categoryId);
  appendParam(url.searchParams, "clickKeywordLimit", args.clickKeywordLimit);
  appendParam(url.searchParams, "sendDryRun", args.sendDryRun);
  appendParam(url.searchParams, "steps", args.steps);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  const bodyText = await response.text();
  let body;

  try {
    body = JSON.parse(bodyText);
  } catch {
    body = bodyText;
  }

  if (!response.ok) {
    console.error(JSON.stringify(body, null, 2));
    throw new Error(`Cron request failed with HTTP ${response.status}.`);
  }

  console.log(JSON.stringify(body, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
