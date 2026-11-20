-- 34-message-key-per-tenant / up.sql
-- Step 1 of 2. Adds a unique index on (tenantId, keyId) next to the global one on keyId (QA 2026-11-20).
-- WhatsApp gives a message the same id on both sides of a chat; when both numbers are on the platform, the global
-- unique index let the first business that stored a message take it from the other one.
-- Additive: the code running today keeps using the global index. Apply BEFORE deploying the code that upserts on
-- (tenantId, keyId); apply 35 only AFTER that code is deployed. One transaction:
-- psql -v ON_ERROR_STOP=1 -1 -f up.sql

CREATE UNIQUE INDEX "whatsapp_messages_tenantId_keyId_key" ON "whatsapp_messages"("tenantId", "keyId");
