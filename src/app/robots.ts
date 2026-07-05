import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-config";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl();

  return {
    host: appUrl,
    rules: {
      allow: ["/", "/deals", "/categories", "/products/", "/keywords/", "/feed.xml"],
      disallow: [
        "/admin/",
        "/alerts",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/api/",
        "/out/",
      ],
      userAgent: "*",
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
