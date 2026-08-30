export type PushSubscriptionInput = {
  auth?: unknown;
  endpoint?: unknown;
  keyword?: unknown;
  maxPrice?: unknown;
  p256dh?: unknown;
  productSlug?: unknown;
};

export type NormalizedPushSubscription = {
  auth: string;
  endpoint: string;
  keyword: string | null;
  maxPrice: number | null;
  p256dh: string;
  productSlug: string | null;
};

export type PushSubscriptionResult =
  | { error: PushSubscriptionError; subscription: null }
  | { error: null; subscription: NormalizedPushSubscription };

export type PushSubscriptionError =
  | "invalid-endpoint"
  | "invalid-keys"
  | "invalid-max-price"
  | "no-target";

const MAX_KEYWORD_LENGTH = 60;
const MAX_PRICE = 100_000_000;

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates a subscription posted by a browser before it reaches the database.
 *
 * The endpoint comes from the push service the browser chose, so it is
 * attacker-influenced input: anything accepted here is a URL the server will
 * later send requests to. Restricting it to https keeps this from becoming a
 * way to point the sender at arbitrary hosts.
 *
 * A subscription must name something to watch. Without a keyword or a product
 * it would match every deal and the subscriber would get everything, which is
 * how a push channel earns a permission revocation.
 */
export function normalizePushSubscription(
  input: PushSubscriptionInput,
): PushSubscriptionResult {
  const endpoint = asTrimmedString(input.endpoint);
  let parsed: URL;

  try {
    parsed = new URL(endpoint);
  } catch {
    return { error: "invalid-endpoint", subscription: null };
  }

  if (parsed.protocol !== "https:") {
    return { error: "invalid-endpoint", subscription: null };
  }

  const p256dh = asTrimmedString(input.p256dh);
  const auth = asTrimmedString(input.auth);

  if (!p256dh || !auth) {
    return { error: "invalid-keys", subscription: null };
  }

  const keyword = asTrimmedString(input.keyword)
    .replace(/\s+/g, " ")
    .slice(0, MAX_KEYWORD_LENGTH);
  const productSlug = asTrimmedString(input.productSlug);

  if (!keyword && !productSlug) {
    return { error: "no-target", subscription: null };
  }

  let maxPrice: number | null = null;

  if (input.maxPrice !== undefined && input.maxPrice !== null && input.maxPrice !== "") {
    const parsedPrice = Number(input.maxPrice);

    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice <= 0 ||
      parsedPrice > MAX_PRICE
    ) {
      return { error: "invalid-max-price", subscription: null };
    }

    maxPrice = Math.floor(parsedPrice);
  }

  return {
    error: null,
    subscription: {
      auth,
      endpoint: parsed.toString(),
      keyword: keyword || null,
      maxPrice,
      p256dh,
      productSlug: productSlug || null,
    },
  };
}

export const PUSH_SUBSCRIPTION_ERROR_MESSAGES: Record<
  PushSubscriptionError,
  string
> = {
  "invalid-endpoint": "브라우저가 보낸 구독 주소를 인식하지 못했습니다.",
  "invalid-keys": "구독 정보가 올바르지 않습니다. 다시 시도해 주세요.",
  "invalid-max-price": "목표가는 1원 이상 1억원 이하로 입력해 주세요.",
  "no-target": "알림받을 상품이나 키워드를 지정해 주세요.",
};
