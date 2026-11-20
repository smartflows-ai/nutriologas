-- 32-whatsapp-risk / up.sql
-- Additive: new columns with defaults, plus one flags table. Old code ignores them.
-- Ban prevention B3 (risk states, circuit breaker, kill switches). NOT applied to production yet.
-- Apply BEFORE the code. Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql

-- Per WhatsApp instance: where the connection stands and whether sending is allowed.
ALTER TABLE "connected_apps" ADD COLUMN "riskState" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "connected_apps" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "connected_apps" ADD COLUMN "lastConnectedAt" TIMESTAMP(3);
ALTER TABLE "connected_apps" ADD COLUMN "lastDisconnectedAt" TIMESTAMP(3);
ALTER TABLE "connected_apps" ADD COLUMN "lastSuccessfulSendAt" TIMESTAMP(3);
ALTER TABLE "connected_apps" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "connected_apps" ADD COLUMN "sendingPausedAt" TIMESTAMP(3);
ALTER TABLE "connected_apps" ADD COLUMN "killSwitch" BOOLEAN NOT NULL DEFAULT FALSE;

-- Per business: its own kill switch.
ALTER TABLE "tenants" ADD COLUMN "whatsappKillSwitch" BOOLEAN NOT NULL DEFAULT FALSE;

-- Global kill switch: one row, read on every send. A flag in the database takes effect at once (an env var would need a redeploy).
CREATE TABLE "platform_flags" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "globalKillSwitch" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_flags_pkey" PRIMARY KEY ("id")
);
INSERT INTO "platform_flags" ("id") VALUES ('global') ON CONFLICT ("id") DO NOTHING;
