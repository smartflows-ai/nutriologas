-- 35-message-key-drop-global / up.sql
-- Step 2 of 2. Drops the global unique index on keyId, so two businesses can each store the same WhatsApp message
-- (QA 2026-11-20). Apply ONLY AFTER the code that upserts on (tenantId, keyId) is deployed: the older code upserts
-- on keyId alone and needs this index (ON CONFLICT ("keyId")). One transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql

DROP INDEX "whatsapp_messages_keyId_key";
