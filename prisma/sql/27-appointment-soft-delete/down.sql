-- Exact reverse of up.sql (ticket #103). Run only after the code that reads these columns is gone.
-- It refuses to run while any visit is deleted or any delete / restore row exists: without the columns the app
-- could no longer tell a deleted visit apart, so it would come back to the agenda (taking its slot, getting
-- reminders), and the history of who deleted what would be lost. It never deletes or changes visits on its own:
-- restore or remove those visits by hand first.
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f down.sql
SET LOCAL lock_timeout = '5s';
-- Lock before the check so no visit can be deleted between the check and the drop.
LOCK TABLE "appointments" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "appointment_trail" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  deleted_count integer;
  trail_count integer;
BEGIN
  SELECT count(*) INTO deleted_count FROM "appointments" WHERE "deletedAt" IS NOT NULL;
  SELECT count(*) INTO trail_count FROM "appointment_trail";
  IF deleted_count > 0 OR trail_count > 0 THEN
    RAISE EXCEPTION 'down.sql stopped: % deleted visit(s) and % delete/restore row(s) exist. Restore or remove them by hand first.', deleted_count, trail_count;
  END IF;
END
$$;

ALTER TABLE "appointment_trail" DROP CONSTRAINT "appointment_trail_userId_fkey";
ALTER TABLE "appointment_trail" DROP CONSTRAINT "appointment_trail_appointmentId_fkey";
ALTER TABLE "appointment_trail" DROP CONSTRAINT "appointment_trail_tenantId_fkey";
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_deletedById_fkey";

DROP INDEX "appointments_tenantId_deletedAt_idx";

DROP TABLE "appointment_trail";

ALTER TABLE "appointments" DROP COLUMN "deletedById",
DROP COLUMN "deletedAt";

DROP TYPE "AppointmentTrailAction";
