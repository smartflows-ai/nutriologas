-- 35-message-key-drop-global / down.sql
-- Exact reverse of up.sql. Fails if two businesses already stored the same message id after up.sql; in that case
-- list them first: SELECT "keyId", count(*) FROM "whatsapp_messages" GROUP BY 1 HAVING count(*) > 1;

CREATE UNIQUE INDEX "whatsapp_messages_keyId_key" ON "whatsapp_messages"("keyId");
