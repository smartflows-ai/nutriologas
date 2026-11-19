-- 30-whatsapp-ban-prevention / down.sql
-- Exact reverse of up.sql. Drops the columns and the consent / opt-out data they hold.
-- Run only to undo the change, after the code that reads these columns is gone.

ALTER TABLE "whatsapp_chats" DROP COLUMN "optedOutSource";
ALTER TABLE "whatsapp_chats" DROP COLUMN "optedOutAt";

ALTER TABLE "appointments" DROP COLUMN "bookingChannel";
ALTER TABLE "appointments" DROP COLUMN "whatsappConsentSource";
ALTER TABLE "appointments" DROP COLUMN "whatsappConsentAt";

ALTER TABLE "tenants" DROP COLUMN "quietHoursEndMin";
ALTER TABLE "tenants" DROP COLUMN "quietHoursStartMin";
ALTER TABLE "tenants" DROP COLUMN "messagingEnforcedAt";
ALTER TABLE "tenants" DROP COLUMN "messagingPolicyMode";
