-- 32-whatsapp-risk / down.sql
-- Exact reverse of up.sql. Drops the risk and kill-switch columns and the flags table.
-- Run only after the code that reads them is gone. It refuses while any kill switch or risk state is set,
-- so a paused instance or an active switch is never removed silently.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "platform_flags" WHERE "globalKillSwitch") THEN
    RAISE EXCEPTION 'the global kill switch is on: turn it off before reverting';
  END IF;
  IF EXISTS (SELECT 1 FROM "tenants" WHERE "whatsappKillSwitch") THEN
    RAISE EXCEPTION 'a tenant kill switch is on: turn it off before reverting';
  END IF;
  IF EXISTS (SELECT 1 FROM "connected_apps" WHERE "riskState" <> 'NORMAL' OR "killSwitch") THEN
    RAISE EXCEPTION 'an instance is paused or has a kill switch on: review it before reverting';
  END IF;
END $$;

DROP TABLE IF EXISTS "platform_flags";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "whatsappKillSwitch";
ALTER TABLE "connected_apps" DROP COLUMN IF EXISTS "killSwitch";
ALTER TABLE "connected_apps" DROP COLUMN IF EXISTS "sendingPausedAt";
ALTER TABLE "connected_apps" DROP COLUMN IF EXISTS "consecutiveFailures";
ALTER TABLE "connected_apps" DROP COLUMN IF EXISTS "lastSuccessfulSendAt";
ALTER TABLE "connected_apps" DROP COLUMN IF EXISTS "lastDisconnectedAt";
ALTER TABLE "connected_apps" DROP COLUMN IF EXISTS "lastConnectedAt";
ALTER TABLE "connected_apps" DROP COLUMN IF EXISTS "statusReason";
ALTER TABLE "connected_apps" DROP COLUMN IF EXISTS "riskState";
