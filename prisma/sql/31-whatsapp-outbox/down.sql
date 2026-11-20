-- 31-whatsapp-outbox / down.sql
-- Exact reverse of up.sql. DELETES the outbox history (the audit of every message the platform queued or sent).
-- Run only after the code that writes to whatsapp_outbox is gone.
-- It refuses to run while the table still holds rows, so the audit is never dropped by accident.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "whatsapp_outbox") THEN
    RAISE EXCEPTION 'whatsapp_outbox still has rows: export or decide before dropping the audit';
  END IF;
END $$;

DROP TABLE IF EXISTS "whatsapp_outbox";
