import { getAppUrl } from "@/lib/app-config";
import { formatKoreanPrice, getDealProducts } from "@/lib/deal-products";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getRssDate(value?: Date | null) {
  return (value ?? new Date()).toUTCString();
}

export async function GET() {
  const appUrl = getAppUrl();
  const products = await getDealProducts({ limit: 50 });
  const now = new Date();

  const items = products
    .slice(0, 50)
    .map((product) => {
      const productUrl = `${appUrl}/products/${product.slug}`;
      const description = [
        `${product.title} 특가 추적 정보입니다.`,
        `현재가 ${formatKoreanPrice(product.price)}`,
        `관측 최고가 대비 ${product.discountRate}% 할인`,
        product.dealInsight.reasons[0],
      ]
        .filter(Boolean)
        .join(" ");

      return [
        "    <item>",
        `      <title>${escapeXml(product.title)}</title>`,
        `      <link>${escapeXml(productUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(productUrl)}</guid>`,
        `      <description>${escapeXml(description)}</description>`,
        `      <category>${escapeXml(product.category.name)}</category>`,
        `      <pubDate>${getRssDate(product.lastCheckedAt)}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>페어프라이스 쿠팡 특가 피드</title>",
    "    <link>" + escapeXml(appUrl) + "</link>",
    "    <description>쿠팡 상품 가격 추적과 특가 알림을 위한 최신 상품 피드입니다.</description>",
    "    <language>ko-KR</language>",
    "    <lastBuildDate>" + now.toUTCString() + "</lastBuildDate>",
    `    <atom:link href="${escapeXml(`${appUrl}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=900",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
