CREATE TYPE "DealVerdict" AS ENUM (
  'COLLECTING',
  'STRONG_DEAL',
  'DEAL',
  'LOWEST',
  'GOOD',
  'AVERAGE',
  'WAIT'
);

CREATE TABLE "product_deal_analytics" (
  "id" TEXT NOT NULL,
  "product_variant_id" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "score_version" TEXT NOT NULL DEFAULT 'fair-score-v1',
  "verdict" "DealVerdict" NOT NULL DEFAULT 'COLLECTING',
  "confidence" "DataConfidence" NOT NULL DEFAULT 'COLLECTING',
  "current_price" INTEGER NOT NULL,
  "lowest_price" INTEGER NOT NULL,
  "highest_price" INTEGER NOT NULL,
  "median_price" INTEGER NOT NULL,
  "p10_price" INTEGER NOT NULL,
  "p25_price" INTEGER NOT NULL,
  "p75_price" INTEGER NOT NULL,
  "p90_price" INTEGER NOT NULL,
  "previous_price" INTEGER,
  "previous_drop_rate" INTEGER NOT NULL DEFAULT 0,
  "median_drop_rate" INTEGER NOT NULL DEFAULT 0,
  "price_percentile" INTEGER NOT NULL DEFAULT 100,
  "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sample_count" INTEGER NOT NULL DEFAULT 0,
  "tracking_days" INTEGER NOT NULL DEFAULT 1,
  "freshness_hours" INTEGER NOT NULL DEFAULT 0,
  "components" JSONB,
  "reasons" JSONB,
  "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_deal_analytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_deal_analytics_product_variant_id_key"
  ON "product_deal_analytics"("product_variant_id");
CREATE INDEX "product_deal_analytics_score_confidence_calculated_at_idx"
  ON "product_deal_analytics"("score", "confidence", "calculated_at");
CREATE INDEX "product_deal_analytics_verdict_score_idx"
  ON "product_deal_analytics"("verdict", "score");

ALTER TABLE "product_deal_analytics"
  ADD CONSTRAINT "product_deal_analytics_product_variant_id_fkey"
  FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "product_deal_analytics" (
  "id",
  "product_variant_id",
  "confidence",
  "current_price",
  "lowest_price",
  "highest_price",
  "median_price",
  "p10_price",
  "p25_price",
  "p75_price",
  "p90_price",
  "sample_count",
  "tracking_days",
  "components",
  "reasons"
)
SELECT
  'analytics_' || variant."id",
  variant."id",
  COALESCE(quality."confidence", 'COLLECTING'::"DataConfidence"),
  product."current_price",
  product."current_price",
  product."current_price",
  product."current_price",
  product."current_price",
  product."current_price",
  product."current_price",
  product."current_price",
  COALESCE(quality."valid_samples", 1),
  GREATEST(1, CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(quality."tracking_started_at", product."created_at"))) / 86400)::INTEGER),
  '{"bootstrap": true}'::JSONB,
  '["분석 스냅샷 재계산 대기 중"]'::JSONB
FROM "product_variants" AS variant
JOIN "products" AS product ON product."id" = variant."product_id"
LEFT JOIN "product_data_quality" AS quality ON quality."product_variant_id" = variant."id"
ON CONFLICT ("product_variant_id") DO NOTHING;
