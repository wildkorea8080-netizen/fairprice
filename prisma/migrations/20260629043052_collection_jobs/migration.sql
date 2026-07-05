-- CreateEnum
CREATE TYPE "CollectionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "collection_jobs" (
    "id" TEXT NOT NULL,
    "collection_rule_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 10,
    "status" "CollectionJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "summary" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_jobs_status_run_after_priority_idx" ON "collection_jobs"("status", "run_after", "priority");

-- CreateIndex
CREATE INDEX "collection_jobs_collection_rule_id_status_idx" ON "collection_jobs"("collection_rule_id", "status");

-- AddForeignKey
ALTER TABLE "collection_jobs" ADD CONSTRAINT "collection_jobs_collection_rule_id_fkey" FOREIGN KEY ("collection_rule_id") REFERENCES "collection_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
