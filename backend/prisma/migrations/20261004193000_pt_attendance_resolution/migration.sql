-- Ended PT bookings with a valid check-in wait for the trainer to confirm the result.
ALTER TYPE "BookingStatus" ADD VALUE 'AWAITING_COMPLETION';

ALTER TABLE "pt_bookings"
ADD COLUMN "attendanceCheckedInAt" TIMESTAMP(3);

-- Preserve a qualifying check-in for confirmed bookings created before this migration.
UPDATE "pt_bookings" AS booking
SET "attendanceCheckedInAt" = (
  SELECT checkin."checkedInAt"
  FROM "checkins" AS checkin
  JOIN "pt_slots" AS slot ON slot."id" = booking."slotId"
  WHERE checkin."memberId" = booking."memberId"
    AND checkin."checkedInAt" >= slot."startsAt" - INTERVAL '60 minutes'
    AND checkin."checkedInAt" <= slot."endsAt" + INTERVAL '5 minutes'
  ORDER BY checkin."checkedInAt" ASC
  LIMIT 1
)
WHERE booking."status" = 'CONFIRMED';
