-- 21-patient-intake: age and modality of a visit, and how each business sees patients.
-- Additive only: nullable columns, plus one column with a default, so the old code keeps working.
-- Apply BEFORE deploying the code that reads these columns (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
CREATE TYPE "AppointmentModality" AS ENUM ('IN_PERSON', 'ONLINE');
CREATE TYPE "ServiceModes" AS ENUM ('IN_PERSON', 'ONLINE', 'BOTH');

ALTER TABLE "appointments"
  ADD COLUMN "modality" "AppointmentModality",
  ADD COLUMN "customerAge" INTEGER,
  ADD COLUMN "meetUrl" TEXT,
  ADD CONSTRAINT "appointments_customerAge_range" CHECK ("customerAge" IS NULL OR ("customerAge" >= 0 AND "customerAge" <= 120));

ALTER TABLE "tenants"
  ADD COLUMN "serviceModes" "ServiceModes" NOT NULL DEFAULT 'IN_PERSON';
