-- 30-whatsapp-ban-prevention / up.sql
-- Additive. Strict consent, opt-out and quiet hours for WhatsApp (feat/whatsapp-ban-prevention).
-- All new columns are nullable or have a default, so the old code keeps working until the new code deploys.
-- Apply BEFORE the code (database first). Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql

-- Tenant: consent-gate mode and quiet hours.
ALTER TABLE "tenants" ADD COLUMN "messagingPolicyMode" TEXT NOT NULL DEFAULT 'SHADOW';
ALTER TABLE "tenants" ADD COLUMN "messagingEnforcedAt" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "quietHoursStartMin" INTEGER;
ALTER TABLE "tenants" ADD COLUMN "quietHoursEndMin" INTEGER;

-- Appointment: verifiable consent for proactive messages about the visit.
ALTER TABLE "appointments" ADD COLUMN "whatsappConsentAt" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "whatsappConsentSource" TEXT;
ALTER TABLE "appointments" ADD COLUMN "bookingChannel" TEXT;

-- WhatsAppChat: opt-out.
ALTER TABLE "whatsapp_chats" ADD COLUMN "optedOutAt" TIMESTAMP(3);
ALTER TABLE "whatsapp_chats" ADD COLUMN "optedOutSource" TEXT;
