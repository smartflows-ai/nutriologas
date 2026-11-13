-- Exact reverse of up.sql. Deletes the short codes already issued: the links stop working. Only run after the
-- code that reads the column is gone.
DROP INDEX "appointments_tenantId_meetShortCode_key";

ALTER TABLE "appointments" DROP COLUMN "meetShortCode";
