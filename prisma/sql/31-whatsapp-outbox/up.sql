-- 31-whatsapp-outbox / up.sql
-- Additive: a new table only. Nothing existing changes, so the old code keeps working until the new code is deployed.
-- Ban prevention B2 (outbox, idempotency, audit). NOT applied to production yet: needs a verified pg_dump and approval.
-- Apply BEFORE the code that writes to it. Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql

CREATE TABLE "whatsapp_outbox" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "recipientKey" TEXT NOT NULL,
  "recipient" TEXT,
  "purpose" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'immediate',
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "policyDecision" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "body" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_outbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One message per idempotency key and business: a retry of the same send can never create a second row.
CREATE UNIQUE INDEX "whatsapp_outbox_tenantId_idempotencyKey_key" ON "whatsapp_outbox"("tenantId", "idempotencyKey");
CREATE INDEX "whatsapp_outbox_status_scheduledAt_idx" ON "whatsapp_outbox"("status", "scheduledAt");
CREATE INDEX "whatsapp_outbox_tenantId_createdAt_idx" ON "whatsapp_outbox"("tenantId", "createdAt");

-- Tenant mode: SHADOW measures what would be blocked and sends everything; ENFORCE blocks without consent.
-- Default SHADOW keeps today's behavior. (Migration 30 already adds messagingPolicyMode; this line is for the outbox only.)
