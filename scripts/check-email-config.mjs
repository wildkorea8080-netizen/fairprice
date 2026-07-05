import { readFileSync } from "node:fs";

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

function maskEmailFrom(value = "") {
  return value.replace(/([^<\s]{2})[^<@\s]*(@[^>\s]+)/, "$1***$2");
}

function isPlaceholder(value = "") {
  return /example\.com|your-domain|replace-with|change_this/i.test(value);
}

function main() {
  const env = {
    ...parseEnvFile(".env.local"),
    ...process.env,
  };
  const apiKey = env.RESEND_API_KEY?.trim();
  const emailFrom = env.EMAIL_FROM?.trim();
  const apiKeyReady = Boolean(apiKey && !isPlaceholder(apiKey));
  const emailFromReady = Boolean(
    emailFrom && emailFrom.includes("@") && !isPlaceholder(emailFrom),
  );

  console.log(`RESEND_API_KEY: ${apiKeyReady ? "configured" : "missing"}`);
  console.log(
    `EMAIL_FROM: ${
      emailFromReady ? maskEmailFrom(emailFrom) : "missing or placeholder"
    }`,
  );

  if (!apiKeyReady || !emailFromReady) {
    console.log("Email configuration: FAIL");
    console.log("Set RESEND_API_KEY and a verified EMAIL_FROM address.");
    process.exitCode = 1;
    return;
  }

  console.log("Email configuration: PASS");
}

main();
