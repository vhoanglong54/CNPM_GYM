ALTER TABLE "notifications" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");
