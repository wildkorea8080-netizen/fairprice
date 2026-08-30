-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "pushed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "deals_status_pushed_at_idx" ON "deals"("status", "pushed_at");
