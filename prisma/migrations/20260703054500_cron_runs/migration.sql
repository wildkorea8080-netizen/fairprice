-- CreateEnum
CREATE TYPE "CronRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "cron_runs" (
    "id" TEXT NOT NULL,
    "status" "CronRunStatus" NOT NULL DEFAULT 'RUNNING',
    "requested_steps" JSONB NOT NULL,
    "options" JSONB,
    "summary" JSONB,
    "succeeded_steps" INTEGER NOT NULL DEFAULT 0,
    "failed_steps" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cron_runs_status_started_at_idx" ON "cron_runs"("status", "started_at");

-- CreateIndex
CREATE INDEX "cron_runs_started_at_idx" ON "cron_runs"("started_at");
