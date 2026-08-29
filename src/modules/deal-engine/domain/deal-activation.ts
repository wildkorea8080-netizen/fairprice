import type { DealDataConfidence } from "./data-confidence";

export type DealActivationTier = "CANDIDATE" | "CONFIRMED";

export type DealActivationInput = {
  /** Score floor for a candidate deal. Comes from config.thresholds.deal (80). */
  candidateThreshold: number;
  confidence: DealDataConfidence;
  /** Score floor for a confirmed deal. Comes from config.thresholds.special (90). */
  confirmedThreshold: number;
  score: number;
};

/**
 * Splits activation into two honest tiers instead of one impossible one.
 *
 * The original rule required score >= special (90) with confidence above
 * COLLECTING, but the PRELIMINARY score cap is 89, so only RELIABLE products
 * could ever activate - and until a product has 20 samples over 30 days there
 * are none. The home page's hot deal feed had never once been able to fire.
 *
 * CONFIRMED keeps the strict bar: RELIABLE data at the special threshold.
 * CANDIDATE admits PRELIMINARY data at the deal threshold, which is inside the
 * PRELIMINARY cap, so a product with a week of history can surface while its
 * confidence is stated honestly in the UI.
 */
export function getDealActivationTier(
  input: DealActivationInput,
): DealActivationTier | null {
  if (input.confidence === "COLLECTING") {
    return null;
  }

  if (input.confidence === "RELIABLE" && input.score >= input.confirmedThreshold) {
    return "CONFIRMED";
  }

  if (input.score >= input.candidateThreshold) {
    return "CANDIDATE";
  }

  return null;
}
