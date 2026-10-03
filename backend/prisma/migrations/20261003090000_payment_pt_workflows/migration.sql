-- Extend payment lifecycle so member transfers require staff confirmation.
ALTER TYPE "PaymentStatus" ADD VALUE 'AWAITING_CONFIRMATION';
ALTER TYPE "PaymentStatus" ADD VALUE 'REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';

-- Extend PT booking lifecycle for explicit rejection and no-show handling.
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';
ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

-- Payment request, confirmation and rejection audit fields.
ALTER TABLE "payments"
ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;

UPDATE "payments"
SET "requestedAt" = "paidAt", "confirmedAt" = "paidAt"
WHERE "paidAt" IS NOT NULL;

ALTER TABLE "payments" ALTER COLUMN "paidAt" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "paidAt" DROP NOT NULL;

-- Reserve a PT session as soon as a booking request is created.
ALTER TABLE "member_pt_packages"
ADD COLUMN "sessionsReserved" INTEGER NOT NULL DEFAULT 0;

UPDATE "member_pt_packages" AS package
SET "sessionsReserved" = active_bookings.total
FROM (
  SELECT "memberPtPackageId", COUNT(*)::INTEGER AS total
  FROM "pt_bookings"
  WHERE "status" IN ('PENDING', 'CONFIRMED')
  GROUP BY "memberPtPackageId"
) AS active_bookings
WHERE package."id" = active_bookings."memberPtPackageId";

ALTER TABLE "pt_bookings"
ADD COLUMN "resolutionReason" TEXT,
ADD COLUMN "resolvedById" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3);

ALTER TABLE "pt_bookings"
ADD CONSTRAINT "pt_bookings_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Verified trainer reviews: one review per completed booking.
CREATE TABLE "trainer_reviews" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "trainerId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trainer_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trainer_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "trainer_reviews_bookingId_key" ON "trainer_reviews"("bookingId");
CREATE INDEX "trainer_reviews_trainerId_createdAt_idx" ON "trainer_reviews"("trainerId", "createdAt");

ALTER TABLE "trainer_reviews"
ADD CONSTRAINT "trainer_reviews_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "pt_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trainer_reviews"
ADD CONSTRAINT "trainer_reviews_trainerId_fkey"
FOREIGN KEY ("trainerId") REFERENCES "trainer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trainer_reviews"
ADD CONSTRAINT "trainer_reviews_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "member_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
