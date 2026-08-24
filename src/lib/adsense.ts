const ADSENSE_PUBLISHER_ID_PATTERN = /^pub-\d{10,}$/;

export function normalizeAdsensePublisherId(value?: string | null) {
  const normalized = value?.trim().replace(/^ca-/, "") ?? "";
  return ADSENSE_PUBLISHER_ID_PATTERN.test(normalized) ? normalized : null;
}

export function createAdsTxtRecord(publisherId: string) {
  return `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;
}
