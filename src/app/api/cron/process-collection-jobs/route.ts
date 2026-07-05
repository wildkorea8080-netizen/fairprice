import { timingSafeEqual } from "node:crypto";
import {
  enqueueCollectionJobs,
  processPendingCollectionJobs,
} from "@/lib/collection-jobs";
import { isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

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
  const enqueue = url.searchParams.get("enqueue") !== "false";
  const batchSize = Number(url.searchParams.get("batchSize")) || 5;

  try {
    const enqueued = enqueue ? await enqueueCollectionJobs() : 0;
    const result = await processPendingCollectionJobs({ batchSize });

    return Response.json({
      completedAt: new Date().toISOString(),
      enqueued,
      result,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Collection job processing failed",
      },
      { status: 500 },
    );
  }
}
