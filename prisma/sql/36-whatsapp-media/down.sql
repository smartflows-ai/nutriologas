-- 36-whatsapp-media / down.sql: exact reverse of up.sql (ticket #182). Run only after the code that reads these
-- tables is gone.
-- It refuses to run while any file may still have a copy in the private store (a row PENDING, STORED or FAILED not
-- yet destroyed, or with a storage path and no destruction date): dropping the rows would leave those copies with
-- nobody to destroy them. FAILED counts because an upload whose answer was lost may have left a copy.
-- Destroy the copies first (the 15-minute job, or by hand), then run this. It never deletes a copy by itself.
-- The hide / restore history is dropped with the tables, and so is their row level security.
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f down.sql
SET LOCAL lock_timeout = '5s';
-- Lock before the check so no file can be stored between the check and the drop.
LOCK TABLE "whatsapp_media" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "whatsapp_media_trail" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  live_copies integer;
BEGIN
  SELECT count(*) INTO live_copies FROM "whatsapp_media"
  WHERE "destroyedAt" IS NULL AND ("status" IN ('PENDING', 'STORED', 'FAILED') OR "storagePath" IS NOT NULL);
  IF live_copies > 0 THEN
    RAISE EXCEPTION 'down.sql stopped: % file(s) may still have a copy in the private store. Destroy them first.', live_copies;
  END IF;
END
$$;

ALTER TABLE "whatsapp_media_trail" DROP CONSTRAINT "whatsapp_media_trail_userId_fkey";
ALTER TABLE "whatsapp_media_trail" DROP CONSTRAINT "whatsapp_media_trail_mediaId_fkey";
ALTER TABLE "whatsapp_media_trail" DROP CONSTRAINT "whatsapp_media_trail_tenantId_fkey";
ALTER TABLE "whatsapp_media" DROP CONSTRAINT "whatsapp_media_hiddenById_fkey";
ALTER TABLE "whatsapp_media" DROP CONSTRAINT "whatsapp_media_messageId_fkey";
ALTER TABLE "whatsapp_media" DROP CONSTRAINT "whatsapp_media_chatId_fkey";
ALTER TABLE "whatsapp_media" DROP CONSTRAINT "whatsapp_media_tenantId_fkey";

DROP TABLE "whatsapp_media_trail";
DROP TABLE "whatsapp_media";

DROP TYPE "WhatsAppMediaTrailAction";
DROP TYPE "WhatsAppMediaStatus";
DROP TYPE "WhatsAppMediaKind";
