-- 33-chat-messaging-reactivation / down.sql
-- Exact reverse of up.sql. Drops the record of who reactivated messages for a chat.
-- Run only to undo the change, after the code that reads these columns is gone.

ALTER TABLE "whatsapp_chats" DROP COLUMN "messagingReactivatedById";
ALTER TABLE "whatsapp_chats" DROP COLUMN "messagingReactivatedAt";
