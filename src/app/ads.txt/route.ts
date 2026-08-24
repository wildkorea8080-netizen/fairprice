import {
  createAdsTxtRecord,
  normalizeAdsensePublisherId,
} from "@/lib/adsense";

export const dynamic = "force-dynamic";

export function GET() {
  const publisherId = normalizeAdsensePublisherId(
    process.env.GOOGLE_ADSENSE_PUBLISHER_ID ??
      process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT,
  );

  if (!publisherId) {
    return new Response("Google AdSense publisher ID is not configured.\n", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(createAdsTxtRecord(publisherId), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
