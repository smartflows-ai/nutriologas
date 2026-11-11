-- 23-user-access: staff users managed by the owner (ticket #22).
-- isActive: false blocks sign-in and cuts an open session on its next request.
-- mustChangePassword: true after the owner creates the user or resets the password; only the change screen works.
-- sessionVersion: goes up on a password reset or a deactivation. A session carries the version it was issued
--   for, so every earlier session (for example a stolen cookie) stops working for good. Existing sessions carry
--   none and count as 0, so nobody is signed out when this ships.
-- Additive only: three columns with a default, so the old code keeps working and no existing row changes meaning.
-- Apply BEFORE deploying the code that reads these columns (database first, code after): every session read uses them.
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
-- Fail fast instead of queueing behind a long transaction and stalling traffic on "users".
SET LOCAL lock_timeout = '5s';
ALTER TABLE "users"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
