-- Add the generic Deal Engine identity and offer layer without removing the
-- compatibility product catalog used by the current Fairprice UI.
CREATE TABLE "deal_entities" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "canonical_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT,
    "image_url" TEXT,
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deal_entities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "deal_entity_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_key" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "affiliate_url" TEXT,
    "seller" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_observed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_variants" ADD COLUMN "deal_entity_id" TEXT;

ALTER TABLE "price_observations"
    ADD COLUMN "offer_id" TEXT,
    ADD COLUMN "seller" TEXT,
    ADD COLUMN "affiliate_url" TEXT,
    ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KRW',
    ADD COLUMN "metadata" JSONB;

CREATE TABLE "daily_price_aggregates" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open_price" INTEGER NOT NULL,
    "close_price" INTEGER NOT NULL,
    "lowest_price" INTEGER NOT NULL,
    "highest_price" INTEGER NOT NULL,
    "median_price" INTEGER NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "available_count" INTEGER NOT NULL,
    "last_observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_price_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deal_entities_entity_type_canonical_key_key"
    ON "deal_entities"("entity_type", "canonical_key");
CREATE INDEX "deal_entities_entity_type_is_active_idx"
    ON "deal_entities"("entity_type", "is_active");
CREATE INDEX "deal_entities_normalized_title_idx"
    ON "deal_entities"("normalized_title");
CREATE UNIQUE INDEX "product_variants_deal_entity_id_key"
    ON "product_variants"("deal_entity_id");
CREATE UNIQUE INDEX "offers_source_external_key_key"
    ON "offers"("source", "external_key");
CREATE INDEX "offers_deal_entity_id_is_active_idx"
    ON "offers"("deal_entity_id", "is_active");
CREATE INDEX "offers_source_last_observed_at_idx"
    ON "offers"("source", "last_observed_at");
CREATE INDEX "price_observations_offer_id_checked_at_idx"
    ON "price_observations"("offer_id", "checked_at");
CREATE UNIQUE INDEX "daily_price_aggregates_offer_id_date_key"
    ON "daily_price_aggregates"("offer_id", "date");
CREATE INDEX "daily_price_aggregates_date_lowest_price_idx"
    ON "daily_price_aggregates"("date", "lowest_price");

-- Backfill one generic entity and one offer per current shopping variant.
INSERT INTO "deal_entities" (
    "id", "entity_type", "canonical_key", "title", "normalized_title",
    "image_url", "is_active", "created_at", "updated_at"
)
SELECT
    'entity_' || md5(variant."id"),
    'SHOPPING_PRODUCT',
    'coupang:' || variant."external_key",
    product_group."title",
    product_group."normalized_title",
    product_group."image_url",
    variant."is_active",
    variant."created_at",
    variant."updated_at"
FROM "product_variants" AS variant
JOIN "product_groups" AS product_group
    ON product_group."id" = variant."product_group_id";

UPDATE "product_variants"
SET "deal_entity_id" = 'entity_' || md5("id");

INSERT INTO "offers" (
    "id", "deal_entity_id", "source", "external_key", "source_url",
    "affiliate_url", "currency", "availability", "is_active",
    "last_observed_at", "created_at", "updated_at"
)
SELECT
    'offer_' || md5(variant."id"),
    variant."deal_entity_id",
    CASE WHEN variant."coupang_product_id" IS NULL THEN 'LEGACY' ELSE 'COUPANG' END,
    variant."external_key",
    COALESCE(product."coupang_url", product."partner_url", 'https://www.coupang.com/'),
    product."partner_url",
    'KRW',
    CASE WHEN variant."is_active" THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END,
    variant."is_active",
    product."last_checked_at",
    variant."created_at",
    variant."updated_at"
FROM "product_variants" AS variant
LEFT JOIN "products" AS product ON product."id" = variant."product_id";

UPDATE "price_observations" AS observation
SET
    "offer_id" = 'offer_' || md5(observation."product_variant_id"),
    "affiliate_url" = offer."affiliate_url"
FROM "offers" AS offer
WHERE offer."id" = 'offer_' || md5(observation."product_variant_id");

-- Keep one durable daily row while retaining raw observations for a shorter
-- operational retention window.
INSERT INTO "daily_price_aggregates" (
    "id", "offer_id", "date", "open_price", "close_price",
    "lowest_price", "highest_price", "median_price", "sample_count",
    "available_count", "last_observed_at", "created_at", "updated_at"
)
SELECT
    'daily_' || md5(observation."offer_id" || observation."checked_at"::date::text),
    observation."offer_id",
    observation."checked_at"::date,
    (array_agg(observation."price" ORDER BY observation."checked_at" ASC))[1],
    (array_agg(observation."price" ORDER BY observation."checked_at" DESC))[1],
    min(observation."price"),
    max(observation."price"),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY observation."price"))::integer,
    count(*)::integer,
    count(*) FILTER (WHERE observation."is_available" = true)::integer,
    max(observation."checked_at"),
    min(observation."created_at"),
    max(observation."created_at")
FROM "price_observations" AS observation
WHERE
    observation."offer_id" IS NOT NULL
    AND observation."status" = 'SUCCESS'
    AND observation."is_anomaly" = false
    AND observation."price" IS NOT NULL
GROUP BY observation."offer_id", observation."checked_at"::date;

ALTER TABLE "product_variants"
    ADD CONSTRAINT "product_variants_deal_entity_id_fkey"
    FOREIGN KEY ("deal_entity_id") REFERENCES "deal_entities"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "offers"
    ADD CONSTRAINT "offers_deal_entity_id_fkey"
    FOREIGN KEY ("deal_entity_id") REFERENCES "deal_entities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_observations"
    ADD CONSTRAINT "price_observations_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_price_aggregates"
    ADD CONSTRAINT "daily_price_aggregates_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
