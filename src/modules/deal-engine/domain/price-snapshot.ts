import type { OfferAvailability } from "@/modules/deal-engine/domain/offer";

export type PriceSnapshotStatus = "FAILED" | "SUCCESS" | "UNAVAILABLE";

export type PriceSnapshot = {
  affiliateUrl?: string;
  availability: OfferAvailability;
  checkedAt: Date;
  currency: string;
  errorCode?: string;
  errorMessage?: string;
  externalOfferKey: string;
  metadata?: Record<string, unknown>;
  originalPrice?: number;
  price?: number;
  requestId?: string;
  seller?: string;
  source: string;
  status: PriceSnapshotStatus;
};
