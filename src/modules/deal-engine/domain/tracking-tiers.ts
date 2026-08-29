export type TrackingTierName = "A" | "B" | "C" | "D";

/**
 * Cumulative rank ceilings, 1-based. The top 100 products land in A, ranks
 * 101-300 in B, 301-1000 in C, and everything after in D.
 *
 * Tiers are assigned by rank rather than by an absolute score because absolute
 * thresholds put nearly the whole catalog into one middle tier: with three
 * members and little click history, almost every product scored the same and
 * none was observed often enough to build confidence. Ranking spends the
 * collection budget on the relative top regardless of how compressed the
 * scores are.
 */
export const TRACKING_TIER_RANK_CEILINGS: Record<
  Exclude<TrackingTierName, "D">,
  number
> = {
  A: 100,
  B: 300,
  C: 1000,
};

/**
 * RELIABLE confidence needs 20 valid samples over 30 days, so one observation
 * a day is sufficient - frequency beyond that only helps deal detection react
 * faster. A and B stay comfortably above daily so the top 300 can reach
 * RELIABLE on schedule; C is a maintenance cadence that can reach PRELIMINARY
 * but deliberately not RELIABLE; D is a weekly pulse so a dormant product's
 * price is not years stale if it resurfaces.
 */
export const TRACKING_TIER_INTERVAL_MINUTES: Record<TrackingTierName, number> = {
  A: 360,
  B: 720,
  C: 4_320,
  D: 10_080,
};

export function getTrackingTierByRank(rank: number): TrackingTierName {
  if (rank <= TRACKING_TIER_RANK_CEILINGS.A) {
    return "A";
  }

  if (rank <= TRACKING_TIER_RANK_CEILINGS.B) {
    return "B";
  }

  if (rank <= TRACKING_TIER_RANK_CEILINGS.C) {
    return "C";
  }

  return "D";
}

export function getTrackingIntervalMinutes(tier: TrackingTierName) {
  return TRACKING_TIER_INTERVAL_MINUTES[tier];
}

/**
 * Rough daily observation demand if every product were refreshed exactly on
 * its interval. Used by tests to keep the tier design inside the API budget
 * rather than discovering an overrun in production.
 */
export function estimateDailyRefreshDemand(totalProducts: number) {
  const perDay = (tier: TrackingTierName) =>
    (24 * 60) / TRACKING_TIER_INTERVAL_MINUTES[tier];
  const inTier = {
    A: Math.min(totalProducts, TRACKING_TIER_RANK_CEILINGS.A),
    B: Math.min(
      Math.max(totalProducts - TRACKING_TIER_RANK_CEILINGS.A, 0),
      TRACKING_TIER_RANK_CEILINGS.B - TRACKING_TIER_RANK_CEILINGS.A,
    ),
    C: Math.min(
      Math.max(totalProducts - TRACKING_TIER_RANK_CEILINGS.B, 0),
      TRACKING_TIER_RANK_CEILINGS.C - TRACKING_TIER_RANK_CEILINGS.B,
    ),
    D: Math.max(totalProducts - TRACKING_TIER_RANK_CEILINGS.C, 0),
  };

  return Math.ceil(
    inTier.A * perDay("A") +
      inTier.B * perDay("B") +
      inTier.C * perDay("C") +
      inTier.D * perDay("D"),
  );
}
