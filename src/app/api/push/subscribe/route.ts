import { getSession } from "@/lib/auth";
import { savePushSubscription } from "@/lib/push-notifications";
import { ensureDatabaseUser } from "@/lib/users";
import {
  normalizePushSubscription,
  PUSH_SUBSCRIPTION_ERROR_MESSAGES,
} from "@/lib/push-subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accepts a browser push subscription. Deliberately open to anonymous
 * visitors: subscribing without an account is the reason this channel exists
 * alongside email alerts, which require signing up first. A session, when
 * present, links the subscription to the account so it can be managed there.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { error, subscription } = normalizePushSubscription(
    (body ?? {}) as Record<string, unknown>,
  );

  if (error) {
    return Response.json(
      { error: PUSH_SUBSCRIPTION_ERROR_MESSAGES[error] },
      { status: 400 },
    );
  }

  try {
    const session = await getSession();
    // Link to the account when there is one, so the subscription can be
    // managed from /alerts. Anonymous subscriptions are stored with a null
    // user, which is the whole point of this channel.
    const user = session ? await ensureDatabaseUser(session) : null;

    await savePushSubscription(subscription, user?.id ?? null);

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "구독을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}
