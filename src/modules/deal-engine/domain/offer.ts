export type OfferAvailability =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type DealOffer = {
  affiliateUrl?: string;
  availability: OfferAvailability;
  currency: string;
  entityCanonicalKey: string;
  externalKey: string;
  metadata?: Record<string, unknown>;
  seller?: string;
  source: string;
  sourceUrl: string;
};
