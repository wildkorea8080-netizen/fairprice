export type AnalyticsConfig = {
  scriptUrl: string;
  websiteId: string;
};

/**
 * Reads the self-hosted Umami settings. Both values end up in the served HTML,
 * so neither is a secret - but they deliberately skip the NEXT_PUBLIC_ prefix,
 * which in Next.js means "inline into the client bundle at build time". The
 * script tag is rendered by a server component, so reading them at runtime
 * keeps a configuration change one restart away instead of one rebuild away.
 *
 * Returns null unless both are present and the URL is a well-formed http(s)
 * endpoint. A half-configured analytics tag is worse than none: it renders a
 * broken script and reports nothing while looking installed.
 */
export function getAnalyticsConfig(
  env: Record<string, string | undefined> = process.env,
): AnalyticsConfig | null {
  const scriptUrl = env.UMAMI_SCRIPT_URL?.trim() ?? "";
  const websiteId = env.UMAMI_WEBSITE_ID?.trim() ?? "";

  if (!scriptUrl || !websiteId) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(scriptUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  return { scriptUrl: parsed.toString(), websiteId };
}
