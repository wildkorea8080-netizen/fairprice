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

function maskEmail(value = "") {
  return value.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}

function requireEmail(value, label) {
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${label} must be a valid email address.`);
  }
}

async function main() {
  const env = {
    ...parseEnvFile(".env.local"),
    ...process.env,
  };
  const args = parseArgs(process.argv.slice(2));
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  const to = String(args.to || env.FAIRPRICE_ADMIN_EMAIL || "").trim();

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required.");
  }

  requireEmail(to, "Recipient");

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a;">
          <p style="margin: 0 0 12px; color: #047857; font-weight: 700;">페어프라이스</p>
          <h1 style="margin: 0 0 16px; font-size: 22px;">이메일 설정 테스트</h1>
          <p>이 메일이 도착했다면 Resend 발송 설정이 정상입니다.</p>
        </div>
      `,
      subject: "[페어프라이스] 이메일 설정 테스트",
      text: "페어프라이스 이메일 설정 테스트입니다. 이 메일이 도착했다면 Resend 발송 설정이 정상입니다.",
      to,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Resend API returned ${response.status}: ${body.slice(0, 300)}`);
  }

  console.log(`Test email sent to ${maskEmail(to)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
