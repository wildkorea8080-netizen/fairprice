import type { DealDataConfidence } from "./data-confidence";

export const TRACKING_CONFIDENCE_BOOSTS: Record<DealDataConfidence, number> = {
  COLLECTING: 10,
  PRELIMINARY: 5,
  RELIABLE: 0,
};

export function getTrackingConfidenceBoost(confidence?: DealDataConfidence | null) {
  return confidence ? TRACKING_CONFIDENCE_BOOSTS[confidence] : 0;
}
