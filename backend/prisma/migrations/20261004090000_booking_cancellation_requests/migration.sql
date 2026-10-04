-- A confirmed PT booking can wait for approval when a member requests a late cancellation.
ALTER TYPE "BookingStatus" ADD VALUE 'CANCEL_REQUESTED';

ALTER TABLE "pt_bookings"
ADD COLUMN "cancellationRequestedById" TEXT,
ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "pt_bookings"
ADD CONSTRAINT "pt_bookings_cancellationRequestedById_fkey"
FOREIGN KEY ("cancellationRequestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
