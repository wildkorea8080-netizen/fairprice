// Mirrored from DATA_CONFIDENCE_THRESHOLDS.reliable rather than imported: the
// unit runner resolves no "@/" alias, and a value import - unlike a type one -
// survives type stripping and fails at run time. A drift guard in the test
// asserts these still match the domain module.
const RELIABLE_SAMPLES = 20;
const RELIABLE_TRACKING_DAYS = 30;

export type CollectionProgressInput = {
  /** Observations recorded across all tracked products in the last 24 hours. */
  observationsLast24h: number;
  preliminary: number;
  /** Products in tracking tiers A and B - the ones the budget is aimed at. */
  prioritisedProducts: number;
  reliable: number;
};

export type CollectionProgress = {
  /** Mean observations per prioritised product per day. */
  observationsPerPriorityProduct: number;
  /** Days to reach RELIABLE at the current rate, or null if it never would. */
  projectedDaysToReliable: number | null;
  status: "healthy" | "stalled" | "unknown";
};

/**
 * Turns raw observation counts into the one question that matters after the
 * depth-over-breadth change: are the products we prioritised actually being
 * observed often enough to reach RELIABLE?
 *
 * RELIABLE needs 20 valid samples over 30 days, so one observation per product
 * per day is the floor. Below that the tier design is not being honoured -
 * refreshes are failing, the budget is too small, or too many products are due
 * at once - and the deal feed will stay empty however the thresholds are
 * tuned. The projection makes that visible before another month passes.
 */
export function getCollectionProgress(
  input: CollectionProgressInput,
): CollectionProgress {
  if (input.prioritisedProducts <= 0 || input.observationsLast24h <= 0) {
    return {
      observationsPerPriorityProduct: 0,
      projectedDaysToReliable: null,
      status: "unknown",
    };
  }

  const perProduct = input.observationsLast24h / input.prioritisedProducts;
  const rounded = Math.round(perProduct * 100) / 100;

  // Under one a day, twenty samples take longer than the thirty-day window
  // RELIABLE also requires, so the requirement is never jointly satisfied.
  if (perProduct < 1) {
    return {
      observationsPerPriorityProduct: rounded,
      projectedDaysToReliable: null,
      status: "stalled",
    };
  }

  return {
    observationsPerPriorityProduct: rounded,
    projectedDaysToReliable: Math.max(
      Math.ceil(RELIABLE_SAMPLES / perProduct),
      RELIABLE_TRACKING_DAYS,
    ),
    status: "healthy",
  };
}
