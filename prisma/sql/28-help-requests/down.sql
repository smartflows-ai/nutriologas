-- Exact reverse of up.sql. Deletes the help state of every chat (reasons, priorities, assignments), the staff
-- WhatsApp numbers and the escalation setting. Only run after the code that reads them is gone.
ALTER TABLE "tenants" DROP COLUMN "helpEscalationMinutes";

ALTER TABLE "users" DROP COLUMN "whatsappNumber";

DROP INDEX "whatsapp_chats_tenantId_helpPriority_updatedAt_idx";

ALTER TABLE "whatsapp_chats" DROP CONSTRAINT "whatsapp_chats_assignedToId_fkey";

ALTER TABLE "whatsapp_chats"
  DROP COLUMN "helpAssignedAt",
  DROP COLUMN "helpCustomerWroteAt",
  DROP COLUMN "helpTakenAt",
  DROP COLUMN "helpOwnerNotifiedAt",
  DROP COLUMN "helpAssigneeNotifiedAt",
  DROP COLUMN "assignedToId",
  DROP COLUMN "helpRequestedAt",
  DROP COLUMN "helpPriority",
  DROP COLUMN "helpReason";
