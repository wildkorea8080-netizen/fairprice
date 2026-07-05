export function getProductOutboundPath(slug: string, sourcePage = "product") {
  const searchParams = new URLSearchParams({ source: sourcePage });

  return `/out/${encodeURIComponent(slug)}?${searchParams.toString()}`;
}
