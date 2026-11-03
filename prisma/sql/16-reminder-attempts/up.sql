-- Ticket #16: track failed reminder sends so the CRM can show them. Additive only: no existing row changes.
-- Apply BEFORE deploying the code that reads these columns.
ALTER TABLE "appointments"
  ADD COLUMN "reminderAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reminderLastError" TEXT,
  ADD COLUMN "reminderLastAttemptAt" TIMESTAMP(3);
