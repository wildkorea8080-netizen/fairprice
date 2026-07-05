import { timingSafeEqual } from "node:crypto";
import { discoverKeywordCandidatesFromCoupang } from "@/lib/coupang/keyword-discovery";
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
  const modeValue = url.searchParams.get("mode") ?? "all";
  const mode =
    modeValue === "goldbox" || modeValue === "category" ? modeValue : "all";
  const categoryId = Number(url.searchParams.get("categoryId")) || 1014;

  try {
    const summary = await discoverKeywordCandidatesFromCoupang({
      categoryId,
      mode,
    });

    return Response.json({
      completedAt: new Date().toISOString(),
      summary,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Keyword discovery failed",
      },
      { status: 500 },
    );
  }
}
