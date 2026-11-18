-- 28-help-requests: WhatsApp chats that need a person (HITL): reason, priority, who is in charge and the
-- escalation clock; the WhatsApp number of each staff member; the minutes before the owner is told.
-- Additive only: nullable columns and columns with a default; existing rows keep "no help needed" (priority 0).
-- Apply BEFORE deploying the code that reads it (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
ALTER TABLE "whatsapp_chats"
  ADD COLUMN "helpReason" TEXT,
  ADD COLUMN "helpPriority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "helpRequestedAt" TIMESTAMP(3),
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "helpAssigneeNotifiedAt" TIMESTAMP(3),
  ADD COLUMN "helpOwnerNotifiedAt" TIMESTAMP(3),
  ADD COLUMN "helpTakenAt" TIMESTAMP(3),
  ADD COLUMN "helpAssignedAt" TIMESTAMP(3),
  ADD COLUMN "helpCustomerWroteAt" TIMESTAMP(3);

ALTER TABLE "whatsapp_chats"
  ADD CONSTRAINT "whatsapp_chats_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "whatsapp_chats_tenantId_helpPriority_updatedAt_idx" ON "whatsapp_chats" ("tenantId", "helpPriority", "updatedAt");

ALTER TABLE "users" ADD COLUMN "whatsappNumber" TEXT;

ALTER TABLE "tenants" ADD COLUMN "helpEscalationMinutes" INTEGER NOT NULL DEFAULT 15;
