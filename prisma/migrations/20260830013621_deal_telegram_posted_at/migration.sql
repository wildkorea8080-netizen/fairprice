-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "telegram_posted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "deals_status_telegram_posted_at_idx" ON "deals"("status", "telegram_posted_at");
