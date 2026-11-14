-- 26-meet-short-code: a short code per online appointment, for the customer link on the tenant's subdomain
-- (<tenant>.newaigent.com/online/<code>). The code hides the real video call link and is unique per business.
-- Additive only: one nullable column and one unique index; existing visits keep NULL (they keep the real link).
-- Apply BEFORE deploying the code that reads it (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
ALTER TABLE "appointments" ADD COLUMN "meetShortCode" TEXT;

-- NULLs do not collide in PostgreSQL, so visits without a code are not affected by the unique index.
CREATE UNIQUE INDEX "appointments_tenantId_meetShortCode_key" ON "appointments" ("tenantId", "meetShortCode");
