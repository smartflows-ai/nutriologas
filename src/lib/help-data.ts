// src/lib/help-data.ts
// The real I/O behind help-requests.ts: Prisma for the chat rows and WhatsApp for the notices.
// Every query is limited by tenantId; the tenant never comes from user input.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyTenantOwner, sendWhatsAppMessage } from "@/lib/whatsapp";
import { UNANSWERED_MINUTES, type AssignmentDeps, type EscalationDeps, type HelpChatRow, type HelpDeps, type HelpTenant, type UnansweredSource } from "@/lib/help-requests";
import type { Assistant } from "@/lib/help-routing";

export const HELP_CHAT_SELECT = {
  id: true,
  tenantId: true,
  helpReason: true,
  helpPriority: true,
  helpRequestedAt: true,
  assignedToId: true,
  helpAssigneeNotifiedAt: true,
  helpOwnerNotifiedAt: true,
  helpTakenAt: true,
  helpAssignedAt: true,
} as const;

export const HELP_TENANT_SELECT = { id: true, slug: true, customDomain: true, helpEscalationMinutes: true } as const;

export const realHelpDeps: HelpDeps = {
  async loadAssistants(tenantId): Promise<Assistant[]> {
    const staff = await prisma.user.findMany({
      where: { tenantId, role: "STAFF" },
      select: { id: true, isActive: true, whatsappNumber: true },
    });
    if (staff.length === 0) return [];
    const [open, history] = await Promise.all([
      prisma.whatsAppChat.groupBy({
        by: ["assignedToId"],
        where: { tenantId, helpPriority: { gt: 0 }, assignedToId: { not: null } },
        _count: { _all: true },
      }),
      prisma.whatsAppChat.groupBy({
        by: ["assignedToId"],
        where: { tenantId, assignedToId: { not: null } },
        _max: { helpAssigneeNotifiedAt: true },
      }),
    ]);
    const openById = new Map(open.map((row) => [row.assignedToId, row._count._all]));
    const lastById = new Map(history.map((row) => [row.assignedToId, row._max.helpAssigneeNotifiedAt]));
    return staff.map((user) => ({
      id: user.id,
      active: user.isActive,
      whatsappNumber: user.whatsappNumber,
      openCount: openById.get(user.id) ?? 0,
      lastNotifiedAt: lastById.get(user.id) ?? null,
    }));
  },

  async saveChat(id, data) {
    await prisma.whatsAppChat.update({ where: { id }, data: data as Prisma.WhatsAppChatUncheckedUpdateInput });
  },

  async sendToAssistant(tenantId, assistantId, text) {
    const user = await prisma.user.findFirst({
      where: { id: assistantId, tenantId, role: "STAFF", isActive: true },
      select: { whatsappNumber: true },
    });
    if (!user?.whatsappNumber) return false;
    // A hand-off notice to the assistant's own number: internal, no customer consent.
    return (await sendWhatsAppMessage({ tenantId, to: user.whatsappNumber, text, purpose: "INTERNAL", recipientIsTeam: true })).success;
  },

  sendToOwner: (tenantId, text) => notifyTenantOwner(tenantId, text),
};

export const realEscalationDeps: EscalationDeps = {
  async loadWaiting() {
    const rows = await prisma.whatsAppChat.findMany({
      where: { helpPriority: { gt: 0 }, helpAssigneeNotifiedAt: { not: null }, helpOwnerNotifiedAt: null, helpTakenAt: null },
      select: { ...HELP_CHAT_SELECT, tenant: { select: HELP_TENANT_SELECT } },
      take: 500,
    });
    return rows.map(({ tenant, ...chat }) => ({ chat: chat as HelpChatRow, tenant: tenant as HelpTenant }));
  },
  saveChat: realHelpDeps.saveChat,
  sendToOwner: realHelpDeps.sendToOwner,
};

export const realAssignmentDeps: AssignmentDeps = {
  async loadPending() {
    const rows = await prisma.whatsAppChat.findMany({
      where: { helpPriority: { gt: 0 }, assignedToId: { not: null }, helpAssignedAt: { not: null }, helpTakenAt: null, helpOwnerNotifiedAt: null },
      select: { ...HELP_CHAT_SELECT, tenant: { select: HELP_TENANT_SELECT } },
      take: 500,
    });
    return rows.map(({ tenant, ...chat }) => ({ chat: chat as HelpChatRow, tenant: tenant as HelpTenant }));
  },
  saveChat: realHelpDeps.saveChat,
  sendToAssistant: realHelpDeps.sendToAssistant,
  sendToOwner: realHelpDeps.sendToOwner,
};

/** Chats that moved in the last day whose last message is the customer's. A reply of any kind clears the candidate. */
export const realUnansweredSource: UnansweredSource = {
  async loadCandidates() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await prisma.whatsAppChat.findMany({
      where: { updatedAt: { gte: since }, helpPriority: { lt: 2 } },
      select: {
        ...HELP_CHAT_SELECT,
        tenant: { select: HELP_TENANT_SELECT },
        messages: { orderBy: { timestamp: "desc" }, take: 1, select: { fromMe: true, timestamp: true, content: true } },
      },
      take: 500,
    });
    const waitingSince = Date.now() - UNANSWERED_MINUTES * 60 * 1000;
    const out: { chat: HelpChatRow; tenant: HelpTenant; lastInboundAt: Date }[] = [];
    for (const { tenant, messages, ...chat } of rows) {
      const last = messages[0];
      // A reaction or a media placeholder needs no answer.
      if (!last || last.fromMe || last.timestamp.getTime() > waitingSince || /^(Reacci|\[)/.test(last.content)) continue;
      out.push({ chat: chat as HelpChatRow, tenant: tenant as HelpTenant, lastInboundAt: last.timestamp });
    }
    return out;
  },
};
