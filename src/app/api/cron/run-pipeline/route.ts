import { timingSafeEqual } from "node:crypto";
import {
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
  "alerts",
  "send",
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
  const batchSize = Number(url.searchParams.get("batchSize")) || 5;
  const categoryId = Number(url.searchParams.get("categoryId")) || 1014;
  const clickKeywordLimit = Number(url.searchParams.get("clickKeywordLimit")) || 10;
  const sendDryRun = parseBoolean(url.searchParams.get("sendDryRun"));
  const steps = parseSteps(url.searchParams.get("steps"));

  try {
    const summary = await runCronPipeline({
      batchSize,
      categoryId,
      clickKeywordLimit,
      sendDryRun,
      steps,
    });

    return Response.json(summary);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Cron pipeline failed",
      },
      { status: 500 },
    );
  }
}
