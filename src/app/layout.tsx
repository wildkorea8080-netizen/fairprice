import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAnalyticsConfig } from "@/lib/analytics";
import { getAppUrl } from "@/lib/app-config";
import "./globals.css";

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;
const naverSiteVerification = process.env.NAVER_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  title: {
    default: "페어프라이스 | 쿠팡 할인 감시",
    template: "%s | 페어프라이스",
  },
  description:
    "쿠팡 상품 가격을 추적하고 할인율, 카테고리, 관심 키워드별 특가 알림을 제공하는 페어프라이스입니다.",
  keywords: [
    "페어프라이스",
    "쿠팡 할인",
    "쿠팡 특가",
    "가격 추적",
    "특가 알림",
    "할인 감시",
  ],
  openGraph: {
    description:
      "할인율과 관심 조건으로 쿠팡 특가를 확인하는 가격 추적 서비스입니다.",
    locale: "ko_KR",
    siteName: "페어프라이스",
    title: "페어프라이스 | 쿠팡 할인 감시",
    type: "website",
  },
  verification: {
    google: googleSiteVerification,
    other: naverSiteVerification
      ? {
          "naver-site-verification": naverSiteVerification,
        }
      : undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read per request rather than at module load so the tag appears on the next
  // restart after Coolify gets the values, without a rebuild.
  const analytics = getAnalyticsConfig();

  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {analytics ? (
          // Umami is cookieless and stores no personal data, so this needs no
          // consent banner. defer keeps it off the critical path.
          <script
            data-website-id={analytics.websiteId}
            defer
            src={analytics.scriptUrl}
          />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
