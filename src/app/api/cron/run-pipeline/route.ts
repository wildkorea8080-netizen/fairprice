import { timingSafeEqual } from "node:crypto";
import {
  CronPipelineAlreadyRunningError,
  runCronPipeline,
  type CronPipelineStep,
} from "@/lib/cron-pipeline";
import { isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

const ALLOWED_STEPS = new Set<CronPipelineStep>([
  "discover",
  "click-keywords",
  "collect",
  "refresh",
  "alerts",
  "send",
  "push",
  "telegram",
  "cleanup",
]);

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!secret || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  const provided = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function parseBoolean(value: string | null) {
  if (value === null) {
    return undefined;
  }

  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function parseSteps(value: string | null) {
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((step) => step.trim())
    .filter((step): step is CronPipelineStep =>
      ALLOWED_STEPS.has(step as CronPipelineStep),
    );
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const batchSize = parseBoundedInteger(
    url.searchParams.get("batchSize"),
    5,
    1,
    50,
  );
  const categoryId = parseBoundedInteger(
    url.searchParams.get("categoryId"),
    1014,
    1,
    9999,
  );
  const clickKeywordLimit = parseBoundedInteger(
    url.searchParams.get("clickKeywordLimit"),
    10,
    1,
    100,
  );
  const refreshBudget = parseBoundedInteger(
    url.searchParams.get("refreshBudget"),
    25,
    1,
    100,
  );
  const sendDryRun = parseBoolean(url.searchParams.get("sendDryRun"));
  const steps = parseSteps(url.searchParams.get("steps"));

  try {
    const summary = await runCronPipeline({
      batchSize,
      categoryId,
      clickKeywordLimit,
      refreshBudget,
      sendDryRun,
      steps,
    });

    return Response.json(summary);
  } catch (error) {
    if (error instanceof CronPipelineAlreadyRunningError) {
      return Response.json(
        {
          error: error.message,
          runId: error.runId,
          status: "already-running",
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Cron pipeline failed",
      },
      { status: 500 },
    );
  }
}
