-- CreateEnum
CREATE TYPE "TrackingTier" AS ENUM ('A', 'B', 'C', 'D');

-- CreateTable
CREATE TABLE "product_tracking_policies" (
    "id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "tier" "TrackingTier" NOT NULL DEFAULT 'C',
    "interval_minutes" INTEGER NOT NULL DEFAULT 720,
    "priority_score" INTEGER NOT NULL DEFAULT 10,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "next_check_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_scheduled_at" TIMESTAMP(3),
    "reasons" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_tracking_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_tracking_policies_product_variant_id_key" ON "product_tracking_policies"("product_variant_id");
CREATE INDEX "product_tracking_policies_is_enabled_next_check_at_priority_score_idx" ON "product_tracking_policies"("is_enabled", "next_check_at", "priority_score");
CREATE INDEX "product_tracking_policies_tier_next_check_at_idx" ON "product_tracking_policies"("tier", "next_check_at");

-- AddForeignKey
ALTER TABLE "product_tracking_policies" ADD CONSTRAINT "product_tracking_policies_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing active products begin in the balanced tier. The policy refresh step
-- will promote or demote them using real engagement signals.
INSERT INTO "product_tracking_policies" (
    "id", "product_variant_id", "tier", "interval_minutes",
    "priority_score", "is_enabled", "next_check_at", "reasons",
    "created_at", "updated_at"
)
SELECT
    'tracking_' || md5(variant."id"),
    variant."id",
    'C'::"TrackingTier",
    720,
    15,
    variant."is_active",
    CURRENT_TIMESTAMP,
    '{"backfilled":true}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "product_variants" AS variant;
