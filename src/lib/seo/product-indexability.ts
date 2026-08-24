export const PRODUCT_SEO_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const PRODUCT_SEO_MIN_OBSERVATIONS = 2;

export type ProductSeoCandidate = {
  imageUrl?: string | null;
  lastCheckedAt?: Date | null;
  observedSamples: number;
  price: number;
  source?: "database" | "sample";
  title: string;
};

export type ProductSeoEligibility = {
  eligible: boolean;
  reasons: Array<
    | "missing-image"
    | "missing-price"
    | "sample-product"
    | "stale-price"
    | "thin-history"
    | "thin-title"
  >;
};

export function getProductSeoEligibility(
  product: ProductSeoCandidate,
  now = new Date(),
): ProductSeoEligibility {
  const reasons: ProductSeoEligibility["reasons"] = [];

  if (product.source === "sample") reasons.push("sample-product");
  if (product.price <= 0) reasons.push("missing-price");
  if (product.title.trim().length < 8) reasons.push("thin-title");
  if (!product.imageUrl) reasons.push("missing-image");
  if (product.observedSamples < PRODUCT_SEO_MIN_OBSERVATIONS) {
    reasons.push("thin-history");
  }
  if (
    !product.lastCheckedAt ||
    now.getTime() - product.lastCheckedAt.getTime() > PRODUCT_SEO_MAX_AGE_MS
  ) {
    reasons.push("stale-price");
  }

  return { eligible: reasons.length === 0, reasons };
}
