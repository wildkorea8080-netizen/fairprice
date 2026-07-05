-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscoverySource" AS ENUM ('KEYWORD', 'GOLDBOX', 'CATEGORY_BEST', 'USER_URL');

-- CreateTable
CREATE TABLE "collection_rules" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 20,
    "min_discount_rate" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_rule_products" (
    "id" TEXT NOT NULL,
    "collection_rule_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_rule_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "coupang_external_id" TEXT,
    "coupang_product_id" TEXT,
    "coupang_item_id" TEXT,
    "coupang_vendor_item_id" TEXT,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "coupang_url" TEXT NOT NULL,
    "partner_url" TEXT NOT NULL,
    "original_price" INTEGER NOT NULL,
    "current_price" INTEGER NOT NULL,
    "discount_rate" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_discoveries" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source" "DiscoverySource" NOT NULL,
    "source_key" TEXT,
    "rank" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_discoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_histories" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "original_price" INTEGER NOT NULL,
    "discount_rate" INTEGER NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_price_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorite_products" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "keyword" TEXT,
    "product_id" TEXT,
    "category_id" TEXT,
    "min_discount_rate" INTEGER,
    "max_price" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alert_rule_id" TEXT,
    "product_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_product_notes" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_product_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "product_id" TEXT NOT NULL,
    "source_page" TEXT,
    "clicked_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_rules_keyword_key" ON "collection_rules"("keyword");

-- CreateIndex
CREATE INDEX "collection_rules_is_active_idx" ON "collection_rules"("is_active");

-- CreateIndex
CREATE INDEX "collection_rule_products_product_id_idx" ON "collection_rule_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_rule_products_collection_rule_id_product_id_key" ON "collection_rule_products"("collection_rule_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_is_active_sort_order_idx" ON "categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "products_coupang_external_id_key" ON "products"("coupang_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_is_active_idx" ON "products"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "products_coupang_product_id_idx" ON "products"("coupang_product_id");

-- CreateIndex
CREATE INDEX "products_discount_rate_idx" ON "products"("discount_rate");

-- CreateIndex
CREATE INDEX "products_current_price_idx" ON "products"("current_price");

-- CreateIndex
CREATE INDEX "products_is_featured_created_at_idx" ON "products"("is_featured", "created_at");

-- CreateIndex
CREATE INDEX "product_discoveries_source_score_idx" ON "product_discoveries"("source", "score");

-- CreateIndex
CREATE UNIQUE INDEX "product_discoveries_product_id_source_source_key_key" ON "product_discoveries"("product_id", "source", "source_key");

-- CreateIndex
CREATE INDEX "product_price_histories_product_id_checked_at_idx" ON "product_price_histories"("product_id", "checked_at");

-- CreateIndex
CREATE INDEX "user_favorite_products_product_id_idx" ON "user_favorite_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorite_products_user_id_product_id_key" ON "user_favorite_products"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "alert_rules_user_id_is_active_idx" ON "alert_rules"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "alert_rules_keyword_idx" ON "alert_rules"("keyword");

-- CreateIndex
CREATE INDEX "alert_rules_product_id_idx" ON "alert_rules"("product_id");

-- CreateIndex
CREATE INDEX "alert_rules_category_id_idx" ON "alert_rules"("category_id");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_created_at_idx" ON "notification_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "notification_logs_product_id_idx" ON "notification_logs"("product_id");

-- CreateIndex
CREATE INDEX "admin_product_notes_product_id_idx" ON "admin_product_notes"("product_id");

-- CreateIndex
CREATE INDEX "admin_product_notes_admin_user_id_idx" ON "admin_product_notes"("admin_user_id");

-- CreateIndex
CREATE INDEX "click_logs_product_id_created_at_idx" ON "click_logs"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "click_logs_user_id_idx" ON "click_logs"("user_id");

-- AddForeignKey
ALTER TABLE "collection_rule_products" ADD CONSTRAINT "collection_rule_products_collection_rule_id_fkey" FOREIGN KEY ("collection_rule_id") REFERENCES "collection_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_rule_products" ADD CONSTRAINT "collection_rule_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_discoveries" ADD CONSTRAINT "product_discoveries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_histories" ADD CONSTRAINT "product_price_histories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_products" ADD CONSTRAINT "user_favorite_products_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_products" ADD CONSTRAINT "user_favorite_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_product_notes" ADD CONSTRAINT "admin_product_notes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_product_notes" ADD CONSTRAINT "admin_product_notes_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_logs" ADD CONSTRAINT "click_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_logs" ADD CONSTRAINT "click_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
