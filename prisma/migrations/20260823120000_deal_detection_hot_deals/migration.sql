CREATE TABLE "deal_events" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "trigger_price" INTEGER NOT NULL,
    "reference_price" INTEGER,
    "score" INTEGER,
    "evidence" JSONB NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deal_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "primary_event_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "score" INTEGER NOT NULL,
    "rank_score" DOUBLE PRECISION NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deal_events_fingerprint_key"
    ON "deal_events"("fingerprint");
CREATE INDEX "deal_events_offer_id_event_type_detected_at_idx"
    ON "deal_events"("offer_id", "event_type", "detected_at");
CREATE INDEX "deal_events_event_type_detected_at_idx"
    ON "deal_events"("event_type", "detected_at");
CREATE UNIQUE INDEX "deals_dedupe_key_key" ON "deals"("dedupe_key");
CREATE INDEX "deals_status_rank_score_starts_at_idx"
    ON "deals"("status", "rank_score", "starts_at");
CREATE INDEX "deals_offer_id_status_idx" ON "deals"("offer_id", "status");

ALTER TABLE "deal_events"
    ADD CONSTRAINT "deal_events_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals"
    ADD CONSTRAINT "deals_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals"
    ADD CONSTRAINT "deals_primary_event_id_fkey"
    FOREIGN KEY ("primary_event_id") REFERENCES "deal_events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
