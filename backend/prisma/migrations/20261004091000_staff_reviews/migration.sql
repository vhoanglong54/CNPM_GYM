-- Staff reviews are independent from PT bookings and cover both Trainers and Receptionists.
CREATE TABLE "staff_reviews" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "staff_reviews_staffId_memberId_key" ON "staff_reviews"("staffId", "memberId");
CREATE INDEX "staff_reviews_staffId_createdAt_idx" ON "staff_reviews"("staffId", "createdAt");

ALTER TABLE "staff_reviews"
ADD CONSTRAINT "staff_reviews_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_reviews"
ADD CONSTRAINT "staff_reviews_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "member_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the latest legacy PT review from each member for each trainer.
INSERT INTO "staff_reviews" ("id", "staffId", "memberId", "rating", "comment", "createdAt", "updatedAt")
SELECT DISTINCT ON (trainer."userId", legacy."memberId")
  legacy."id",
  trainer."userId",
  legacy."memberId",
  legacy."rating",
  COALESCE(legacy."comment", 'Đánh giá từ lịch sử buổi PT.'),
  legacy."createdAt",
  legacy."updatedAt"
FROM "trainer_reviews" AS legacy
JOIN "trainer_profiles" AS trainer ON trainer."id" = legacy."trainerId"
ORDER BY trainer."userId", legacy."memberId", legacy."updatedAt" DESC;
