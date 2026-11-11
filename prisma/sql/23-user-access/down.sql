-- Exact reverse of up.sql (ticket #22). Run only after the code that reads these columns is gone.
-- It deletes which users were deactivated and which still owe a password change: a deactivated user can sign in
-- again after this runs. It also deletes the session versions: sessions ended by a reset would count again. Check first: SELECT count(*) FROM "users" WHERE NOT "isActive" OR "mustChangePassword";
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f down.sql
SET LOCAL lock_timeout = '5s';
ALTER TABLE "users"
  DROP COLUMN "sessionVersion",
  DROP COLUMN "mustChangePassword",
  DROP COLUMN "isActive";
