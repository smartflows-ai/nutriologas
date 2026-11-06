-- Exact reverse of up.sql. Deletes the "recommended by" data already saved (only run after the code that reads
-- it is gone).
DROP INDEX "appointments_tenantId_referredByKey_idx";

ALTER TABLE "appointments"
  DROP COLUMN "referredByName",
  DROP COLUMN "referredByKey";
