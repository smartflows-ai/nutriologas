-- Exact reverse of up.sql. Deletes every business's chosen time zone: all of them go back to the code's fixed
-- Mexico City time. Only run after the code that reads these columns is gone.
ALTER TABLE "tenants" DROP COLUMN "timeZoneSource";

ALTER TABLE "tenants" DROP COLUMN "timeZone";
