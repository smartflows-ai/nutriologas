-- Owner-activated plan tools rollback. This DELETES the activations stored in the column (which tools each business
-- turned on). Run only after the code that reads it is gone.
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f down.sql
ALTER TABLE "tenants"
  DROP COLUMN "enabledTools";
