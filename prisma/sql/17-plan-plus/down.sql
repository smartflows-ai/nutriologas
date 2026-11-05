-- Plus plan rollback. PostgreSQL cannot drop an enum value, so the type is rebuilt without PLUS.
-- Any subscription on PLUS is moved to PRO first (the closest plan). That is a data change: a PLUS tenant keeps
-- paid features but its plan label changes. Run only after the code that writes PLUS is gone.
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f down.sql
UPDATE "subscriptions" SET "plan" = 'PRO' WHERE "plan" = 'PLUS';

ALTER TYPE "PlanId" RENAME TO "PlanId_old";
CREATE TYPE "PlanId" AS ENUM ('STARTER', 'PRO', 'CLINICA', 'VETERINARY', 'TOURISM', 'ENTERPRISE');

ALTER TABLE "subscriptions" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "plan" TYPE "PlanId" USING ("plan"::text::"PlanId");
ALTER TABLE "subscriptions" ALTER COLUMN "plan" SET DEFAULT 'STARTER';

DROP TYPE "PlanId_old";
