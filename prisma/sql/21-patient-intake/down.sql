-- Exact reverse of up.sql. Deletes the age, modality and meeting links already saved and each business's
-- service setting (only run after the code that reads them is gone).
ALTER TABLE "tenants"
  DROP COLUMN "serviceModes";

ALTER TABLE "appointments"
  DROP CONSTRAINT "appointments_customerAge_range",
  DROP COLUMN "meetUrl",
  DROP COLUMN "customerAge",
  DROP COLUMN "modality";

DROP TYPE "ServiceModes";
DROP TYPE "AppointmentModality";
