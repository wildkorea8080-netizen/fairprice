import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-config";
import { unsubscribeAllAlerts } from "@/lib/alert-subscriptions";

/**
 * RFC 8058 one-click unsubscribe. Mail clients POST here without any user
 * interaction, so this must not require a session and must not redirect.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await unsubscribeAllAlerts(token);

  if (result.status === "invalid") {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  return NextResponse.json({ deactivated: result.deactivated, ok: true });
}

/**
 * Some clients follow the header as a plain link. Hand those to the page so a
 * person confirms before anything changes.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";

  return NextResponse.redirect(
    `${getAppUrl()}/unsubscribe?token=${encodeURIComponent(token)}`,
  );
}
