CREATE TABLE "deal_score_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "vertical" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "experiment_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deal_score_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deal_analysis_snapshots" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "score_config_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "score_band" TEXT NOT NULL,
    "current_price" INTEGER NOT NULL,
    "average_price" INTEGER NOT NULL,
    "lowest_price" INTEGER NOT NULL,
    "highest_price" INTEGER NOT NULL,
    "previous_price" INTEGER,
    "average_drop_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowest_price_proximity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "drop_velocity_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price_percentile" INTEGER NOT NULL DEFAULT 100,
    "confidence" "DataConfidence" NOT NULL,
    "confidence_cap" INTEGER NOT NULL DEFAULT 100,
    "raw_score" INTEGER NOT NULL DEFAULT 0,
    "components" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "tracking_days" INTEGER NOT NULL DEFAULT 1,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deal_analysis_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deal_score_configs_key_version_key"
    ON "deal_score_configs"("key", "version");
CREATE INDEX "deal_score_configs_vertical_is_active_effective_from_idx"
    ON "deal_score_configs"("vertical", "is_active", "effective_from");
CREATE INDEX "deal_analysis_snapshots_offer_id_calculated_at_idx"
    ON "deal_analysis_snapshots"("offer_id", "calculated_at");
CREATE INDEX "deal_analysis_snapshots_score_calculated_at_idx"
    ON "deal_analysis_snapshots"("score", "calculated_at");
CREATE INDEX "deal_analysis_snapshots_score_band_calculated_at_idx"
    ON "deal_analysis_snapshots"("score_band", "calculated_at");

INSERT INTO "deal_score_configs" (
    "id", "key", "version", "vertical", "weights", "thresholds",
    "is_active", "effective_from", "created_at", "updated_at"
) VALUES (
    'deal_score_shopping_v1',
    'shopping-deal-score',
    1,
    'SHOPPING',
    '{"averageDrop":35,"lowestPriceProximity":25,"dropVelocity":15,"historicalPercentile":15,"dataConfidence":10}'::JSONB,
    '{"good":60,"deal":80,"special":90,"legendary":96}'::JSONB,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Preserve the existing latest projections as initial auditable snapshots.
INSERT INTO "deal_analysis_snapshots" (
    "id", "offer_id", "score_config_id", "score", "score_band",
    "current_price", "average_price", "lowest_price", "highest_price",
    "previous_price", "average_drop_rate", "drop_velocity_rate",
    "price_percentile", "confidence", "confidence_cap", "raw_score",
    "components", "reasons", "sample_count", "tracking_days",
    "calculated_at", "created_at"
)
SELECT
    'score_snapshot_' || md5(analytics."id"),
    offer."id",
    'deal_score_shopping_v1',
    analytics."score",
    CASE
        WHEN analytics."score" >= 96 THEN 'LEGENDARY'
        WHEN analytics."score" >= 90 THEN 'SPECIAL'
        WHEN analytics."score" >= 80 THEN 'DEAL'
        WHEN analytics."score" >= 60 THEN 'GOOD'
        ELSE 'GENERAL'
    END,
    analytics."current_price",
    analytics."median_price",
    analytics."lowest_price",
    analytics."highest_price",
    analytics."previous_price",
    analytics."median_drop_rate",
    analytics."previous_drop_rate",
    analytics."price_percentile",
    analytics."confidence",
    CASE
        WHEN analytics."confidence" = 'COLLECTING' THEN 59
        WHEN analytics."confidence" = 'PRELIMINARY' THEN 89
        ELSE 100
    END,
    analytics."score",
    COALESCE(analytics."components", '{}'::JSONB),
    COALESCE(analytics."reasons", '[]'::JSONB),
    analytics."sample_count",
    analytics."tracking_days",
    analytics."calculated_at",
    analytics."created_at"
FROM "product_deal_analytics" AS analytics
JOIN "product_variants" AS variant
    ON variant."id" = analytics."product_variant_id"
JOIN "offers" AS offer
    ON offer."deal_entity_id" = variant."deal_entity_id"
ON CONFLICT DO NOTHING;

ALTER TABLE "deal_analysis_snapshots"
    ADD CONSTRAINT "deal_analysis_snapshots_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_analysis_snapshots"
    ADD CONSTRAINT "deal_analysis_snapshots_score_config_id_fkey"
    FOREIGN KEY ("score_config_id") REFERENCES "deal_score_configs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
