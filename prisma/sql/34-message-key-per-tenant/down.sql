-- 34-message-key-per-tenant / down.sql
-- Exact reverse of up.sql. Run only after the code that upserts on (tenantId, keyId) is gone, and only while
-- 35 is not applied (the global index must exist again first: run 35/down.sql before this file).

DROP INDEX "whatsapp_messages_tenantId_keyId_key";
