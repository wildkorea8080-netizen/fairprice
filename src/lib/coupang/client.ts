import "server-only";

import { createHmac } from "node:crypto";
import type {
  CoupangDeeplink,
  CoupangProduct,
  CoupangSearchResult,
} from "@/lib/coupang/types";

const API_HOST = "https://api-gateway.coupang.com";
const API_PREFIX =
  "/v2/providers/affiliate_open_api/apis/openapi/v1";
const COUPANG_PRODUCT_LIST_LIMIT = 10;

type CoupangApiEnvelope<T> = {
  code?: string | number;
  data?: T;
  message?: string;
  rCode?: string;
  rMessage?: string;
  requestId?: string;
};

function getCredentials() {
  const accessKey = process.env.COUPANG_PARTNERS_ACCESS_KEY?.trim();
  const secretKey = process.env.COUPANG_PARTNERS_SECRET_KEY?.trim();

  if (!accessKey || !secretKey) {
    throw new Error("쿠팡 파트너스 API 키가 설정되지 않았습니다.");
  }

  return { accessKey, secretKey };
}

function getSignedDate(date = new Date()) {
  const parts = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  return parts.slice(2);
}

function createAuthorization(
  method: "GET" | "POST",
  path: string,
  query: string,
) {
  const { accessKey, secretKey } = getCredentials();
  const signedDate = getSignedDate();
  const message = `${signedDate}${method}${path}${query}`;
  const signature = createHmac("sha256", secretKey)
    .update(message)
    .digest("hex");

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

async function coupangRequest<T>(
  method: "GET" | "POST",
  endpoint: string,
  options: {
    body?: unknown;
    query?: URLSearchParams;
  } = {},
) {
  const path = `${API_PREFIX}${endpoint}`;
  const query = options.query?.toString() ?? "";
  const response = await fetch(
    `${API_HOST}${path}${query ? `?${query}` : ""}`,
    {
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      headers: {
        Authorization: createAuthorization(method, path, query),
        "Content-Type": "application/json;charset=UTF-8",
      },
      method,
      signal: AbortSignal.timeout(10_000),
    },
  );

  const payload = (await response.json()) as CoupangApiEnvelope<T>;

  if (!response.ok || payload.rCode && payload.rCode !== "0") {
    throw new Error(
      payload.rMessage ||
        payload.message ||
        `쿠팡 파트너스 API 요청이 실패했습니다. (${response.status})`,
    );
  }

  return payload;
}

function getProductData(
  payload: CoupangApiEnvelope<
    CoupangProduct[] | { productData?: CoupangProduct[] }
  >,
) {
  const products = Array.isArray(payload.data)
    ? payload.data
    : payload.data?.productData ?? [];

  return {
    products,
    requestId: payload.requestId,
  };
}

export async function searchCoupangProducts(
  keyword: string,
  limit = 10,
): Promise<CoupangSearchResult> {
  const safeKeyword = keyword.trim().replace(/\s+/g, " ");

  if (!safeKeyword) {
    return { products: [] };
  }

  const query = new URLSearchParams({
    imageSize: "512",
    keyword: safeKeyword,
    limit: String(Math.min(Math.max(limit, 1), COUPANG_PRODUCT_LIST_LIMIT)),
  });
  const subId = process.env.COUPANG_PARTNERS_SUB_ID?.trim();

  if (subId) {
    query.set("subId", subId);
  }

  const payload = await coupangRequest<
    CoupangProduct[] | { productData?: CoupangProduct[] }
  >(
    "GET",
    "/products/search",
    { query },
  );

  return getProductData(payload);
}

export async function getCoupangGoldboxProducts() {
  const query = new URLSearchParams();
  const subId = process.env.COUPANG_PARTNERS_SUB_ID?.trim();

  if (subId) {
    query.set("subId", subId);
  }

  const payload = await coupangRequest<
    CoupangProduct[] | { productData?: CoupangProduct[] }
  >(
    "GET",
    "/products/goldbox",
    { query },
  );

  return getProductData(payload);
}

export async function getCoupangBestCategoryProducts(
  categoryId: number,
  limit = COUPANG_PRODUCT_LIST_LIMIT,
) {
  const query = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), COUPANG_PRODUCT_LIST_LIMIT)),
  });
  const subId = process.env.COUPANG_PARTNERS_SUB_ID?.trim();

  if (subId) {
    query.set("subId", subId);
  }

  const payload = await coupangRequest<
    CoupangProduct[] | { productData?: CoupangProduct[] }
  >(
    "GET",
    `/products/bestcategories/${categoryId}`,
    { query },
  );

  return getProductData(payload);
}

export async function createCoupangDeeplinks(urls: string[]) {
  const coupangUrls = urls
    .map((url) => url.trim())
    .filter((url) => url.startsWith("https://www.coupang.com/"))
    .slice(0, 20);

  if (coupangUrls.length === 0) {
    return [] satisfies CoupangDeeplink[];
  }

  const payload = await coupangRequest<CoupangDeeplink[]>(
    "POST",
    "/deeplink",
    { body: { coupangUrls } },
  );

  return payload.data ?? [];
}

export function areCoupangCredentialsConfigured() {
  return Boolean(
    process.env.COUPANG_PARTNERS_ACCESS_KEY?.trim() &&
      process.env.COUPANG_PARTNERS_SECRET_KEY?.trim(),
  );
}
