import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type ObservationCleanupSummary = {
  cutoff: string;
  deletedCovered: number;
  deletedDiagnostics: number;
  keptUncovered: number;
};

export const OBSERVATION_RETENTION_DAYS = 90;

/** Rows per category per run. Keeps each delete short-lived on its locks. */
const BATCH = 10_000;

/**
 * Applies the 90-day raw observation retention that price-history-policy.md
 * promised but the first production version deliberately did not enable.
 *
 * Two classes of expired row, treated differently:
 *
 * Successful priced observations are the source long-range charts were built
 * from, so one is deleted only when a daily aggregate row exists for its offer
 * and UTC day - the coverage guarantee from the policy. An old row whose day
 * was never aggregated is kept and counted, not silently dropped, so a gap in
 * aggregation surfaces as a growing keptUncovered number instead of as lost
 * history.
 *
 * Failures, anomalies, and rows without a price or an offer never enter
 * aggregates and exist for provider diagnostics, which the policy also caps at
 * 90 days. Past the cutoff they are deleted unconditionally.
 */
export async function cleanupExpiredObservations({
  now = new Date(),
  retentionDays = OBSERVATION_RETENTION_DAYS,
}: {
  now?: Date;
  retentionDays?: number;
} = {}): Promise<ObservationCleanupSummary> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for observation cleanup.");
  }

  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);

  const deletedCovered = await prisma.$executeRaw`
    DELETE FROM price_observations
    WHERE id IN (
      SELECT po.id
      FROM price_observations po
      JOIN daily_price_aggregates agg
        ON agg.offer_id = po.offer_id
       AND agg.date = (po.checked_at AT TIME ZONE 'UTC')::date
      WHERE po.checked_at < ${cutoff}
        AND po.status = 'SUCCESS'
        AND po.is_anomaly = false
        AND po.price IS NOT NULL
        AND po.offer_id IS NOT NULL
      LIMIT ${BATCH}
    )
  `;

  const deletedDiagnostics = await prisma.$executeRaw`
    DELETE FROM price_observations
    WHERE id IN (
      SELECT id
      FROM price_observations
      WHERE checked_at < ${cutoff}
        AND (
          status <> 'SUCCESS'
          OR is_anomaly = true
          OR price IS NULL
          OR offer_id IS NULL
        )
      LIMIT ${BATCH}
    )
  `;

  const keptUncovered = await prisma.priceObservation.count({
    where: {
      checkedAt: { lt: cutoff },
      isAnomaly: false,
      offerId: { not: null },
      price: { not: null },
      status: "SUCCESS",
    },
  });

  return {
    cutoff: cutoff.toISOString(),
    deletedCovered,
    deletedDiagnostics,
    keptUncovered,
  };
}
