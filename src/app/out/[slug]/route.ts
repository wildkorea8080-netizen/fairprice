import { NextResponse } from "next/server";
import { getProductBySlug } from "@/data/catalog";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OutboundRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

const knownSourcePages = new Set([
  "notification-email",
  "notification-message",
  "product",
  "product-card",
  "product-detail",
  "product-jsonld",
  "unknown",
]);

function safeFallbackUrl(slug: string) {
  return getProductBySlug(slug)?.partnerUrl ?? "https://www.coupang.com/";
}

function safeCoupangUrl(value: string, fallback = "https://www.coupang.com/") {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isCoupangHost =
      hostname === "coupang.com" || hostname.endsWith(".coupang.com");

    if ((url.protocol === "https:" || url.protocol === "http:") && isCoupangHost) {
      return url.toString();
    }
  } catch {
    // Fall through to the safe Coupang home URL.
  }

  return fallback;
}

function normalizeSourcePage(value: string | null) {
  const sourcePage = value?.trim().toLowerCase() || "unknown";

  return knownSourcePages.has(sourcePage) ? sourcePage : "unknown";
}

function redirectToCoupang(url: string) {
  const response = NextResponse.redirect(safeCoupangUrl(url), 302);

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

export async function GET(request: Request, context: OutboundRouteContext) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const sourcePage = normalizeSourcePage(url.searchParams.get("source"));

  if (!isDatabaseConfigured()) {
    return redirectToCoupang(safeFallbackUrl(slug));
  }

  try {
    const product = await prisma.product.findUnique({
      select: {
        id: true,
        isActive: true,
        partnerUrl: true,
      },
      where: { slug },
    });

    if (!product || !product.isActive) {
      return redirectToCoupang(safeFallbackUrl(slug));
    }

    const redirectUrl = safeCoupangUrl(product.partnerUrl);

    const session = await getSession();
    const user = session
      ? await prisma.user.findUnique({
          select: { id: true },
          where: { email: session.email },
        })
      : null;

    await prisma.clickLog.create({
      data: {
        clickedUrl: redirectUrl,
        productId: product.id,
        sourcePage,
        userId: user?.id,
      },
    });

    return redirectToCoupang(redirectUrl);
  } catch {
    return redirectToCoupang(safeFallbackUrl(slug));
  }
}
