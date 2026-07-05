-- CreateEnum
CREATE TYPE "KeywordSourceType" AS ENUM ('MANUAL', 'COUPANG_DISCOVERY', 'USER_ACTIVITY', 'AI_EXPANSION', 'EXTERNAL_TREND');

-- CreateEnum
CREATE TYPE "KeywordCandidateStatus" AS ENUM ('NEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "collection_rules" ALTER COLUMN "limit" SET DEFAULT 10;

-- CreateTable
CREATE TABLE "keyword_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "KeywordSourceType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_candidates" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalized_keyword" TEXT NOT NULL,
    "source_id" TEXT,
    "source_type" "KeywordSourceType" NOT NULL DEFAULT 'MANUAL',
    "source_key" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" "KeywordCandidateStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "last_collected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_sources_is_active_priority_idx" ON "keyword_sources"("is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_sources_name_type_key" ON "keyword_sources"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_candidates_normalized_keyword_key" ON "keyword_candidates"("normalized_keyword");

-- CreateIndex
CREATE INDEX "keyword_candidates_status_score_idx" ON "keyword_candidates"("status", "score");

-- CreateIndex
CREATE INDEX "keyword_candidates_source_type_idx" ON "keyword_candidates"("source_type");

-- AddForeignKey
ALTER TABLE "keyword_candidates" ADD CONSTRAINT "keyword_candidates_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "keyword_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
