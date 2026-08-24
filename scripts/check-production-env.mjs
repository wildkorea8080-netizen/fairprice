import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_ENV_FILE = ".env.production";

const requiredChecks = [
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "Public app URL",
    validate: (value) =>
      Boolean(value?.startsWith("https://") && !isPlaceholder(value)),
    message: "Use the final HTTPS domain, for example https://fairprice.example.com.",
  },
  {
    key: "FAIRPRICE_DEPLOYMENT_MODE",
    label: "Deployment mode",
    validate: (value) => value === "production",
    message: "Set FAIRPRICE_DEPLOYMENT_MODE=production before public launch.",
  },
  {
    key: "DATABASE_URL",
    label: "PostgreSQL URL",
    validate: (value) =>
      Boolean(value?.startsWith("postgresql://") && !isPlaceholder(value)),
    message: "Set the production PostgreSQL connection string.",
  },
  {
    key: "FAIRPRICE_ADMIN_EMAIL",
    label: "Admin email",
    validate: (value) => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
    message: "Set the production administrator email.",
  },
  {
    key: "FAIRPRICE_ADMIN_PASSWORD",
    label: "Admin password",
    validate: (value) => Boolean(value && value.length >= 16 && !isPlaceholder(value)),
    message: "Use a production-only password with at least 16 characters.",
  },
  {
    key: "FAIRPRICE_AUTH_SECRET",
    label: "Auth secret",
    validate: (value) => Boolean(value && value.length >= 32 && !isPlaceholder(value)),
    message: "Use a random session signing secret with at least 32 characters.",
  },
  {
    key: "FAIRPRICE_OPERATOR_NAME",
    label: "Operator name",
    validate: (value) => Boolean(value && value.trim().length >= 2 && !isPlaceholder(value)),
    message: "Set the legal operator or company name shown in terms and privacy pages.",
  },
  {
    key: "FAIRPRICE_CONTACT_EMAIL",
    label: "Contact email",
    validate: (value) => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !isPlaceholder(value)),
    message: "Set a public contact email for legal and user inquiries.",
  },
  {
    key: "CRON_SECRET",
    label: "Cron secret",
    validate: (value) => Boolean(value && value.length >= 32 && !isPlaceholder(value)),
    message: "Use a random cron bearer token with at least 32 characters.",
  },
  {
    key: "COUPANG_PARTNERS_ACCESS_KEY",
    label: "Coupang access key",
    validate: (value) => Boolean(value && !isPlaceholder(value)),
    message: "Set the Coupang Partners access key.",
  },
  {
    key: "COUPANG_PARTNERS_SECRET_KEY",
    label: "Coupang secret key",
    validate: (value) => Boolean(value && !isPlaceholder(value)),
    message: "Set the Coupang Partners secret key.",
  },
  {
    key: "RESEND_API_KEY",
    label: "Resend API key",
    validate: (value) => Boolean(value && !isPlaceholder(value)),
    message: "Set a production Resend API key for transactional email.",
  },
  {
    key: "EMAIL_FROM",
    label: "Email sender",
    validate: (value) => Boolean(value && value.includes("@") && !isPlaceholder(value)),
    message: "Set a verified sender, for example Fairprice <deals@example.com>.",
  },
];

const optionalChecks = [
  {
    key: "COUPANG_PARTNERS_SUB_ID",
    label: "Coupang sub ID",
    message: "Recommended for affiliate reporting.",
  },
  {
    key: "NAVER_SITE_VERIFICATION",
    label: "Naver verification",
    message: "Add before submitting the domain to Naver Search Advisor.",
  },
  {
    key: "GOOGLE_SITE_VERIFICATION",
    label: "Google verification",
    message: "Add before submitting the domain to Google Search Console.",
  },
  {
    key: "GOOGLE_ADSENSE_PUBLISHER_ID",
    label: "Google AdSense publisher ID",
    validate: (value) => /^(?:ca-)?pub-\d{10,}$/.test(value?.trim() || ""),
    message: "Add the pub-... publisher ID so /ads.txt can be served.",
  },
];

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
}

function isPlaceholder(value = "") {
  return /your-domain|replace-with|change_this|example\.com|example\.org/i.test(value);
}

function hasValue(value) {
  return Boolean(value && value.trim() && !isPlaceholder(value));
}

function printResult(status, label, detail) {
  console.log(`${status.padEnd(4)} | ${label} | ${detail}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = resolve(process.cwd(), args.envFile || DEFAULT_ENV_FILE);
  const strict = args.strict !== "false";

  if (!existsSync(envFile)) {
    printResult("FAIL", "Environment file", `${envFile} does not exist.`);
    console.log("Create it from .env.production.example before deployment.");
    process.exit(strict ? 1 : 0);
  }

  const env = parseEnvFile(envFile);
  let failCount = 0;
  let warnCount = 0;

  console.log(`Production environment check: ${envFile}`);

  for (const check of requiredChecks) {
    const ok = check.validate(env[check.key]);

    if (ok) {
      printResult("PASS", check.label, "configured");
    } else {
      failCount += 1;
      printResult("FAIL", check.label, check.message);
    }
  }

  for (const check of optionalChecks) {
    if (check.validate ? check.validate(env[check.key]) : hasValue(env[check.key])) {
      printResult("PASS", check.label, "configured");
    } else {
      warnCount += 1;
      printResult("WARN", check.label, check.message);
    }
  }

  console.log(
    `Environment summary: ${requiredChecks.length - failCount}/${requiredChecks.length} required checks passed, ${warnCount} warnings`,
  );

  if (strict && failCount > 0) {
    process.exit(1);
  }
}

main();
