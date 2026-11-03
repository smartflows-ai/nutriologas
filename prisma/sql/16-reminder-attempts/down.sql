-- Ticket #16 rollback: removes the three columns. This DELETES the data stored in them (failed-send counters and
-- messages), nothing else. Run it only if the change must be undone, and after the code that reads them is gone.
ALTER TABLE "appointments"
  DROP COLUMN "reminderAttempts",
  DROP COLUMN "reminderLastError",
  DROP COLUMN "reminderLastAttemptAt";
