-- STAFF role rollback (ticket #21). PostgreSQL cannot drop an enum value, so the type is rebuilt without STAFF.
-- It refuses to run while any user still has the STAFF role: it never deletes or changes accounts on its own.
-- Delete those users, or change their role by hand, first. Run only after the code that reads STAFF is gone.
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f down.sql
-- Before running it on production, confirm nothing else depends on the type or column:
--   SELECT * FROM pg_policies WHERE tablename = 'users';   (expected: no rows)
-- Retyping the column rewrites "users" under an ACCESS EXCLUSIVE lock: fail fast if it cannot get it.
SET LOCAL lock_timeout = '5s';
-- Lock before the check so no STAFF row can be inserted between the check and the retype.
LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  staff_count integer;
BEGIN
  SELECT count(*) INTO staff_count FROM "users" WHERE "role"::text = 'STAFF';
  IF staff_count > 0 THEN
    RAISE EXCEPTION 'down.sql stopped: % user(s) still have the STAFF role. Delete them or change their role first.', staff_count;
  END IF;
END
$$;

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

DROP TYPE "UserRole_old";
