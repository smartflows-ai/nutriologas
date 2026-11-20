-- 33-chat-messaging-reactivation / up.sql
-- Additive. Records who brought back WhatsApp messages for a patient who had asked to stop (QA 2026-11-20):
-- "Reactivar mensajes" in the chat clears optedOutAt and writes who and when, as the new explicit consent.
-- Both columns are nullable, so the old code keeps working. Apply BEFORE the code (database first), in one
-- transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql

ALTER TABLE "whatsapp_chats" ADD COLUMN "messagingReactivatedAt" TIMESTAMP(3);
ALTER TABLE "whatsapp_chats" ADD COLUMN "messagingReactivatedById" TEXT;
