-- CreateEnum
CREATE TYPE "DataConfidence" AS ENUM ('COLLECTING', 'PRELIMINARY', 'RELIABLE');

-- CreateTable
CREATE TABLE "product_data_quality" (
    "id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "confidence" "DataConfidence" NOT NULL DEFAULT 'COLLECTING',
    "observed_samples" INTEGER NOT NULL DEFAULT 0,
    "valid_samples" INTEGER NOT NULL DEFAULT 0,
    "anomalous_samples" INTEGER NOT NULL DEFAULT 0,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "tracking_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latest_checked_at" TIMESTAMP(3),
    "latest_success_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_data_quality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_data_quality_product_variant_id_key" ON "product_data_quality"("product_variant_id");
CREATE INDEX "product_data_quality_confidence_latest_checked_at_idx" ON "product_data_quality"("confidence", "latest_checked_at");

-- AddForeignKey
ALTER TABLE "product_data_quality" ADD CONSTRAINT "product_data_quality_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill quality counters from the immutable observation store.
INSERT INTO "product_data_quality" (
    "id", "product_variant_id", "confidence", "observed_samples",
    "valid_samples", "anomalous_samples", "consecutive_failures",
    "tracking_started_at", "latest_checked_at", "latest_success_at",
    "created_at", "updated_at"
)
SELECT
    'quality_' || md5(variant."id"),
    variant."id",
    CASE
        WHEN COUNT(observation."id") FILTER (WHERE observation."status" = 'SUCCESS' AND observation."is_anomaly" = false) >= 20
             AND MAX(observation."checked_at") - MIN(observation."checked_at") >= INTERVAL '30 days'
            THEN 'RELIABLE'::"DataConfidence"
        WHEN COUNT(observation."id") FILTER (WHERE observation."status" = 'SUCCESS' AND observation."is_anomaly" = false) >= 5
             AND MAX(observation."checked_at") - MIN(observation."checked_at") >= INTERVAL '7 days'
            THEN 'PRELIMINARY'::"DataConfidence"
        ELSE 'COLLECTING'::"DataConfidence"
    END,
    COUNT(observation."id")::integer,
    COUNT(observation."id") FILTER (WHERE observation."status" = 'SUCCESS' AND observation."is_anomaly" = false)::integer,
    COUNT(observation."id") FILTER (WHERE observation."is_anomaly" = true)::integer,
    0,
    COALESCE(MIN(observation."checked_at"), variant."created_at"),
    MAX(observation."checked_at"),
    MAX(observation."checked_at") FILTER (WHERE observation."status" = 'SUCCESS'),
    variant."created_at",
    CURRENT_TIMESTAMP
FROM "product_variants" AS variant
LEFT JOIN "price_observations" AS observation
    ON observation."product_variant_id" = variant."id"
GROUP BY variant."id", variant."created_at";
