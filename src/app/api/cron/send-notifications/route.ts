import { timingSafeEqual } from "node:crypto";
import { sendPendingNotifications } from "@/lib/notification-sender";
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

function parseBoolean(value: string | null) {
  if (value === null) {
    return undefined;
  }

  return ["1", "true", "yes"].includes(value.toLowerCase());
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
  const limit = Number(url.searchParams.get("limit")) || 20;
  const dryRun = parseBoolean(url.searchParams.get("dryRun"));

  try {
    const summary = await sendPendingNotifications({ dryRun, limit });

    return Response.json({
      completedAt: new Date().toISOString(),
      summary,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Notification sending failed",
      },
      { status: 500 },
    );
  }
}
