-- Owner-activated plan tools (App Store). Additive only: one new column with a default, no existing row changes.
-- Apply BEFORE deploying the code that reads this column (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
ALTER TABLE "tenants"
  ADD COLUMN "enabledTools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
