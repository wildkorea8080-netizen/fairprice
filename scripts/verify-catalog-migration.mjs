import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

try {
  const [
    products,
    variants,
    histories,
    backfilledObservations,
    historiesWithoutObservation,
    productsWithoutVariant,
    observationsWithoutVariant,
    variantsWithoutQuality,
    variantsWithoutTrackingPolicy,
    variantsWithoutDealAnalytics,
    dealEntities,
    offers,
    variantsWithoutDealEntity,
    observationsWithoutOffer,
    dailyAggregates,
    expectedDailyAggregates,
    orphanedDailyAggregates,
    activeDealScoreConfigs,
    offersWithoutAnalysisSnapshot,
    orphanedDealEvents,
    orphanedDeals,
    duplicateActiveDeals,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.productPriceHistory.count(),
    prisma.priceObservation.count({ where: { source: "BACKFILL" } }),
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM product_price_histories AS history
      LEFT JOIN product_variants AS variant
        ON variant.product_id = history.product_id
      LEFT JOIN price_observations AS observation
        ON observation.product_variant_id = variant.id
        AND observation.checked_at = history.checked_at
        AND observation.price = history.price
      WHERE observation.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM products AS product
      LEFT JOIN product_variants AS variant ON variant.product_id = product.id
      WHERE variant.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM price_observations AS observation
      LEFT JOIN product_variants AS variant
        ON variant.id = observation.product_variant_id
      WHERE variant.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM product_variants AS variant
      LEFT JOIN product_data_quality AS quality
        ON quality.product_variant_id = variant.id
      WHERE quality.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM product_variants AS variant
      LEFT JOIN product_tracking_policies AS policy
        ON policy.product_variant_id = variant.id
      WHERE policy.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM product_variants AS variant
      LEFT JOIN product_deal_analytics AS analytics
        ON analytics.product_variant_id = variant.id
      WHERE analytics.id IS NULL
    `,
    prisma.dealEntity.count(),
    prisma.offer.count(),
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM product_variants
      WHERE deal_entity_id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM price_observations
      WHERE offer_id IS NULL
    `,
    prisma.dailyPriceAggregate.count(),
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT observation.offer_id, observation.checked_at::date
        FROM price_observations AS observation
        WHERE
          observation.offer_id IS NOT NULL
          AND observation.status = 'SUCCESS'
          AND observation.is_anomaly = false
          AND observation.price IS NOT NULL
        GROUP BY observation.offer_id, observation.checked_at::date
      ) AS daily_groups
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM daily_price_aggregates AS aggregate
      LEFT JOIN offers AS offer ON offer.id = aggregate.offer_id
      WHERE offer.id IS NULL
    `,
    prisma.dealScoreConfig.count({
      where: { isActive: true, vertical: "SHOPPING" },
    }),
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM offers AS offer
      LEFT JOIN deal_analysis_snapshots AS snapshot
        ON snapshot.offer_id = offer.id
      WHERE snapshot.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM deal_events AS event
      LEFT JOIN offers AS offer ON offer.id = event.offer_id
      WHERE offer.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM deals AS deal
      LEFT JOIN offers AS offer ON offer.id = deal.offer_id
      WHERE offer.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT offer_id
        FROM deals
        WHERE status = 'ACTIVE'
        GROUP BY offer_id
        HAVING COUNT(*) > 1
      ) AS duplicated
    `,
  ]);

  const missingVariants = productsWithoutVariant[0]?.count ?? 0;
  const historiesMissingObservation = historiesWithoutObservation[0]?.count ?? 0;
  const orphanedObservations = observationsWithoutVariant[0]?.count ?? 0;
  const missingQuality = variantsWithoutQuality[0]?.count ?? 0;
  const missingTrackingPolicy = variantsWithoutTrackingPolicy[0]?.count ?? 0;
  const missingDealAnalytics = variantsWithoutDealAnalytics[0]?.count ?? 0;
  const missingDealEntities = variantsWithoutDealEntity[0]?.count ?? 0;
  const missingObservationOffers = observationsWithoutOffer[0]?.count ?? 0;
  const expectedDailyRows = expectedDailyAggregates[0]?.count ?? 0;
  const orphanedDailyRows = orphanedDailyAggregates[0]?.count ?? 0;
  const offersMissingAnalysis = offersWithoutAnalysisSnapshot[0]?.count ?? 0;
  const orphanedEventRows = orphanedDealEvents[0]?.count ?? 0;
  const orphanedDealRows = orphanedDeals[0]?.count ?? 0;
  const duplicatedActiveRows = duplicateActiveDeals[0]?.count ?? 0;
  const checks = {
    everyLegacyHistoryHasObservation: historiesMissingObservation === 0,
    everyProductHasOneVariant: products === variants && missingVariants === 0,
    noOrphanedObservations: orphanedObservations === 0,
    everyVariantHasDataQuality: missingQuality === 0,
    everyVariantHasTrackingPolicy: missingTrackingPolicy === 0,
    everyVariantHasDealAnalytics: missingDealAnalytics === 0,
    everyVariantHasDealEntity:
      dealEntities === variants && missingDealEntities === 0,
    everyVariantHasOffer: offers === variants,
    everyObservationHasOffer: missingObservationOffers === 0,
    dailyAggregatesCoverValidObservations:
      dailyAggregates === expectedDailyRows,
    noOrphanedDailyAggregates: orphanedDailyRows === 0,
    hasActiveShoppingDealScoreConfig: activeDealScoreConfigs > 0,
    everyOfferHasAnalysisSnapshot: offersMissingAnalysis === 0,
    noOrphanedDealEvents: orphanedEventRows === 0,
    noOrphanedDeals: orphanedDealRows === 0,
    noDuplicateActiveDeals: duplicatedActiveRows === 0,
  };

  console.log(
    JSON.stringify(
      {
        checks,
        counts: {
          backfilledObservations,
          histories,
          historiesWithoutObservation: historiesMissingObservation,
          orphanedObservations,
          products,
          productsWithoutVariant: missingVariants,
          variants,
          variantsWithoutQuality: missingQuality,
          variantsWithoutTrackingPolicy: missingTrackingPolicy,
          variantsWithoutDealAnalytics: missingDealAnalytics,
          dealEntities,
          offers,
          variantsWithoutDealEntity: missingDealEntities,
          observationsWithoutOffer: missingObservationOffers,
          dailyAggregates,
          expectedDailyAggregates: expectedDailyRows,
          orphanedDailyAggregates: orphanedDailyRows,
          activeDealScoreConfigs,
          offersWithoutAnalysisSnapshot: offersMissingAnalysis,
          orphanedDealEvents: orphanedEventRows,
          orphanedDeals: orphanedDealRows,
          duplicateActiveDeals: duplicatedActiveRows,
        },
      },
      null,
      2,
    ),
  );

  if (Object.values(checks).some((passed) => !passed)) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
