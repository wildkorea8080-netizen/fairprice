import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const HSTS_HEADER = [
  "strict-transport-security",
  "max-age=31536000; includeSubDomains",
];

const checks = [
  {
    path: "/",
    expect: [200],
    headers: [
      ["x-content-type-options", "nosniff"],
      ["x-frame-options", "DENY"],
      ["referrer-policy", "strict-origin-when-cross-origin"],
      ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
    ],
    name: "home",
    bodyIncludes: ["지금 이 가격", "구매 타이밍을 확인하세요"],
  },
  {
    path: "/deals",
    expect: [200],
    bodyIncludes: ["가격 이력 기반 특가", "관측 최고가 대비 하락률"],
    name: "deals",
  },
  { path: "/categories", expect: [200], name: "categories" },
  {
    path: "/products/wireless-noise-cancelling-earbuds",
    expect: [200],
    bodyIncludes: ["쿠팡 파트너스 제휴 링크"],
    name: "sample product",
  },
  {
    path: "/login",
    expect: [200],
    bodyIncludes: ['<meta name="robots" content="noindex, nofollow"'],
    name: "login noindex",
  },
  {
    path: "/signup",
    expect: [200],
    bodyIncludes: ['<meta name="robots" content="noindex, nofollow"'],
    name: "signup noindex",
  },
  {
    path: "/forgot-password",
    expect: [200],
    bodyIncludes: ['<meta name="robots" content="noindex, nofollow"'],
    name: "forgot password noindex",
  },
  {
    path: "/reset-password",
    expect: [200],
    bodyIncludes: ['<meta name="robots" content="noindex, nofollow"'],
    name: "reset password noindex",
  },
  {
    path: "/api/health",
    expect: [200],
    bodyIncludes: [
      '"service":"fairprice"',
      '"status":"ok"',
      '"checks":',
      '"databaseConfigured":',
      '"coupangPartners":',
      '"cronSecret":',
      '"email":',
      '"legal":',
      '"automationFresh":',
      '"dealEngineFresh":',
      '"priceTrackingFresh":',
      '"automation":',
      '"priceTracking":',
      '"timestamp":',
    ],
    header: ["cache-control", "no-store"],
    name: "health api",
  },
  {
    path: "/sitemap.xml",
    expect: [200],
    bodyIncludes: [
      "/deals",
      "/categories",
      "/products/wireless-noise-cancelling-earbuds",
      "/affiliate-disclosure",
      "/terms",
      "/privacy",
    ],
    name: "sitemap",
  },
  {
    path: "/robots.txt",
    expect: [200],
    bodyIncludes: [
      "Allow: /products/",
      "Allow: /keywords/",
      "Disallow: /admin/",
      "Disallow: /api/",
      "Disallow: /out/",
      "Sitemap:",
    ],
    name: "robots",
  },
  { path: "/feed.xml", expect: [200], name: "rss feed" },
  { path: "/affiliate-disclosure", expect: [200], name: "affiliate disclosure" },
  {
    path: "/terms",
    expect: [200],
    bodyIncludes: ["서비스 운영자는", "mailto:"],
    name: "terms",
  },
  {
    path: "/privacy",
    expect: [200],
    bodyIncludes: ["개인정보 처리 관련 문의", "mailto:"],
    name: "privacy",
  },
  {
    path: "/admin/test",
    expect: [307, 308],
    locationIncludes: "/login",
    name: "admin diagnostics auth guard",
  },
  {
    path: "/alerts",
    expect: [307, 308],
    locationIncludes: "/login",
    name: "alerts auth guard",
  },
  {
    path: "/out/wireless-noise-cancelling-earbuds?source=product-card",
    expect: [302, 307, 308],
    headers: [
      ["cache-control", "no-store"],
      ["x-robots-tag", "noindex, nofollow"],
    ],
    locationIncludes: "coupang.com",
    name: "affiliate redirect",
  },
  {
    path: "/out/not-a-real-product?source=unexpected",
    expect: [302, 307, 308],
    headers: [
      ["cache-control", "no-store"],
      ["x-robots-tag", "noindex, nofollow"],
    ],
    locationIncludes: "coupang.com",
    name: "affiliate fallback redirect",
  },
  {
    path: "/api/cron/run-pipeline",
    expect: [401],
    name: "cron pipeline auth guard",
  },
  {
    path: "/api/cron/collect-products",
    expect: [401],
    name: "collect products cron auth guard",
  },
  {
    path: "/api/cron/discover-keywords",
    expect: [401],
    name: "discover keywords cron auth guard",
  },
  {
    path: "/api/cron/process-collection-jobs",
    expect: [401],
    name: "collection jobs cron auth guard",
  },
  {
    path: "/api/cron/evaluate-alerts",
    expect: [401],
    name: "evaluate alerts cron auth guard",
  },
  {
    path: "/api/cron/send-notifications",
    expect: [401],
    name: "send notifications cron auth guard",
  },
];

function createChecks(options) {
  if (options.requireHsts !== "true") {
    return checks;
  }

  return checks.map((check) => {
    if (check.path !== "/") {
      return check;
    }

    return {
      ...check,
      headers: [...(check.headers ?? []), HSTS_HEADER],
      name: "home security headers",
    };
  });
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

async function runCheck(baseUrl, check) {
  const url = new URL(check.path, baseUrl);
  const response = await fetch(url, { redirect: "manual" });
  const statusOk = check.expect.includes(response.status);
  const location = response.headers.get("location") ?? "";
  const locationOk = check.locationIncludes
    ? location.includes(check.locationIncludes)
    : true;
  const body = check.bodyIncludes ? await response.text() : "";
  const failedBodyIncludes = (check.bodyIncludes ?? []).filter(
    (expected) => !body.includes(expected),
  );
  const bodyOk = failedBodyIncludes.length === 0;
  const headerChecks = check.headers ?? (check.header ? [check.header] : []);
  const failedHeaders = headerChecks
    .map(([key, expected]) => ({
      actual: response.headers.get(key),
      expected,
      key,
    }))
    .filter((header) => header.actual !== header.expected);
  const headerOk = failedHeaders.length === 0;
  const ok = statusOk && locationOk && headerOk && bodyOk;

  return {
    check,
    failedBodyIncludes,
    failedHeaders,
    location,
    ok,
    status: response.status,
  };
}

function formatResult({
  check,
  failedBodyIncludes = [],
  failedHeaders = [],
  location,
  ok,
  status,
}) {
  const expected = check.expect.join("/");
  const parts = [
    ok ? "PASS" : "FAIL",
    check.name,
    `${status} expected ${expected}`,
  ];

  if (check.locationIncludes) {
    parts.push(`location=${location || "-"}`);
  }

  if (failedHeaders.length > 0) {
    parts.push(
      `headers=${failedHeaders
        .map(
          (header) =>
            `${header.key}: expected "${header.expected}", got "${header.actual ?? "-"}"`,
        )
        .join("; ")}`,
    );
  }

  if (failedBodyIncludes.length > 0) {
    parts.push(`bodyMissing=${failedBodyIncludes.join(", ")}`);
  }

  return parts.join(" | ");
}

async function main() {
  const env = {
    ...parseEnvFile(resolve(process.cwd(), ".env.local")),
    ...process.env,
  };
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl || env.NEXT_PUBLIC_APP_URL);
  const results = [];
  const activeChecks = createChecks(args);

  console.log(`Smoke test target: ${baseUrl}`);

  for (const check of activeChecks) {
    try {
      const result = await runCheck(baseUrl, check);
      results.push(result);
      console.log(formatResult(result));
    } catch (error) {
      const result = {
        check,
        location: "",
        ok: false,
        status: "ERROR",
      };
      results.push(result);
      console.log(
        `FAIL | ${check.name} | ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const failed = results.filter((result) => !result.ok);

  console.log(
    `Smoke test summary: ${results.length - failed.length}/${results.length} passed`,
  );

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
