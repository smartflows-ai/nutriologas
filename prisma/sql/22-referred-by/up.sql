-- 22-referred-by: who booked a visit for someone else (an automatic recommendation).
-- Additive only: two nullable columns and an index, so the old code keeps working.
-- Apply BEFORE deploying the code that reads these columns (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
ALTER TABLE "appointments"
  ADD COLUMN "referredByKey" TEXT,
  ADD COLUMN "referredByName" TEXT;

CREATE INDEX "appointments_tenantId_referredByKey_idx" ON "appointments" ("tenantId", "referredByKey");
