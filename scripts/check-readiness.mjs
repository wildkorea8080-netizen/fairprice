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

function normalizeBaseUrl(value) {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  return String(value);
}

async function main() {
  const env = {
    ...parseEnvFile(resolve(process.cwd(), ".env.local")),
    ...process.env,
  };
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl || env.NEXT_PUBLIC_APP_URL);
  const url = new URL("/api/health", baseUrl);
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}.`);
  }

  const health = await response.json();
  const checks = health.checks ?? {};
  const failedChecks = Object.entries(checks).filter(([, value]) => value !== true);

  console.log(`Readiness target: ${baseUrl}`);
  console.log(`Mode: ${formatValue(health.mode)}`);
  console.log(`Status: ${formatValue(health.status)}`);
  console.log(
    `Automation: ${formatValue(health.automation?.status)} (${formatValue(
      health.automation?.minutesSinceLastRun,
    )} min)`,
  );
  console.log(
    `Price tracking: ${formatValue(health.priceTracking?.status)} (${formatValue(
      health.priceTracking?.minutesSinceLatestProductCheck,
    )} min)`,
  );

  if (failedChecks.length === 0) {
    console.log("Readiness: PASS");
    return;
  }

  console.log("Readiness: WARN");
  console.log("Checks requiring attention:");

  for (const [key, value] of failedChecks) {
    console.log(`- ${key}: ${formatValue(value)}`);
  }

  process.exitCode = checks.productionServices === true ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
