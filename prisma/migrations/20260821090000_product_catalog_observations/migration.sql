-- CreateEnum
CREATE TYPE "PriceObservationSource" AS ENUM ('COUPANG_PARTNERS', 'MANUAL', 'BACKFILL');

-- CreateEnum
CREATE TYPE "PriceObservationStatus" AS ENUM ('SUCCESS', 'UNAVAILABLE', 'FAILED');

-- CreateTable
CREATE TABLE "product_groups" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT,
    "image_url" TEXT,
    "normalized_title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_group_id" TEXT NOT NULL,
    "product_id" TEXT,
    "external_key" TEXT NOT NULL,
    "coupang_product_id" TEXT,
    "coupang_item_id" TEXT,
    "coupang_vendor_item_id" TEXT,
    "option_name" TEXT,
    "unit_quantity" DECIMAL(12,3),
    "unit_label" TEXT,
    "pack_count" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "source" "PriceObservationSource" NOT NULL DEFAULT 'COUPANG_PARTNERS',
    "status" "PriceObservationStatus" NOT NULL DEFAULT 'SUCCESS',
    "price" INTEGER,
    "original_price" INTEGER,
    "is_available" BOOLEAN,
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "request_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_groups_slug_key" ON "product_groups"("slug");
CREATE INDEX "product_groups_category_id_idx" ON "product_groups"("category_id");
CREATE INDEX "product_groups_normalized_title_idx" ON "product_groups"("normalized_title");
CREATE UNIQUE INDEX "product_variants_product_id_key" ON "product_variants"("product_id");
CREATE UNIQUE INDEX "product_variants_external_key_key" ON "product_variants"("external_key");
CREATE INDEX "product_variants_product_group_id_is_active_idx" ON "product_variants"("product_group_id", "is_active");
CREATE INDEX "product_variants_coupang_product_id_idx" ON "product_variants"("coupang_product_id");
CREATE INDEX "price_observations_product_variant_id_checked_at_idx" ON "price_observations"("product_variant_id", "checked_at");
CREATE INDEX "price_observations_status_checked_at_idx" ON "price_observations"("status", "checked_at");
CREATE INDEX "price_observations_is_anomaly_checked_at_idx" ON "price_observations"("is_anomaly", "checked_at");

-- AddForeignKey
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "product_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill product groups. Stable Coupang product IDs share a group; manual
-- products fall back to their compatibility product ID.
INSERT INTO "product_groups" (
    "id", "category_id", "title", "slug", "brand", "image_url",
    "normalized_title", "created_at", "updated_at"
)
SELECT DISTINCT ON (COALESCE("coupang_product_id", "id"))
    'group_' || md5(COALESCE("coupang_product_id", "id")),
    "category_id",
    "title",
    CASE
        WHEN "coupang_product_id" IS NOT NULL THEN 'coupang-product-' || "coupang_product_id"
        ELSE 'catalog-' || md5("id")
    END,
    "brand",
    "image_url",
    lower(regexp_replace(trim("title"), '\\s+', ' ', 'g')),
    "created_at",
    "updated_at"
FROM "products"
ORDER BY COALESCE("coupang_product_id", "id"), "created_at" ASC;

-- Backfill one sellable variant for every existing compatibility product.
INSERT INTO "product_variants" (
    "id", "product_group_id", "product_id", "external_key",
    "coupang_product_id", "coupang_item_id", "coupang_vendor_item_id",
    "option_name", "is_active", "created_at", "updated_at"
)
SELECT
    'variant_' || md5("id"),
    'group_' || md5(COALESCE("coupang_product_id", "id")),
    "id",
    COALESCE("coupang_external_id", 'legacy:' || "id"),
    "coupang_product_id",
    "coupang_item_id",
    "coupang_vendor_item_id",
    "title",
    "is_active",
    "created_at",
    "updated_at"
FROM "products";

-- Preserve every legacy price point in the richer observation store.
INSERT INTO "price_observations" (
    "id", "product_variant_id", "source", "status", "price",
    "original_price", "is_available", "is_anomaly", "checked_at", "created_at"
)
SELECT
    'observation_' || md5(history."id"),
    'variant_' || md5(history."product_id"),
    'BACKFILL'::"PriceObservationSource",
    'SUCCESS'::"PriceObservationStatus",
    history."price",
    history."original_price",
    true,
    false,
    history."checked_at",
    history."checked_at"
FROM "product_price_histories" AS history;
