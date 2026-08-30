import { deactivatePushSubscription } from "@/lib/push-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stops delivery to one endpoint. Knowing the endpoint is the authorisation:
 * it is issued by the browser to that browser, so a person who has it is the
 * subscriber. Requiring a login here would strand the anonymous subscriptions
 * this channel exists to serve.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const endpoint =
    typeof (body as { endpoint?: unknown })?.endpoint === "string"
      ? (body as { endpoint: string }).endpoint.trim()
      : "";

  if (!endpoint) {
    return Response.json({ error: "구독 정보가 필요합니다." }, { status: 400 });
  }

  try {
    const { count } = await deactivatePushSubscription(endpoint);

    return Response.json({ deactivated: count, ok: true });
  } catch {
    return Response.json(
      { error: "구독 해제에 실패했습니다." },
      { status: 503 },
    );
  }
}
