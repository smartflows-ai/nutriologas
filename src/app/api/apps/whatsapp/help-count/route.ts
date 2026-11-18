// src/app/api/apps/whatsapp/help-count/route.ts
// GET: The WhatsApp help counters of this person and the assignments the owner made to them in the last day.
// `open` and `high` count the whole business (the owner's counter); `mine` and `mineHigh` count the chats in charge
// of this person (the assistant's counter). `assignments` feeds the in-app notice. Every count: nobody took it yet.
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { ASSIGNMENT_NOTICE_WINDOW_MS, contactLabel, type AssignmentView } from "@/lib/help-view";

export async function GET() {
  const access = await requirePermission("whatsapp.chats");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  const userId = access.session.user.id ?? "";

  const where = { tenantId, helpPriority: { gt: 0 }, helpTakenAt: null } as const;
  const mine = { ...where, assignedToId: userId } as const;
  const since = new Date(Date.now() - ASSIGNMENT_NOTICE_WINDOW_MS);
  const [open, high, mineCount, mineHigh, assigned] = await Promise.all([
    prisma.whatsAppChat.count({ where }),
    prisma.whatsAppChat.count({ where: { ...where, helpPriority: { gte: 2 } } }),
    prisma.whatsAppChat.count({ where: mine }),
    prisma.whatsAppChat.count({ where: { ...mine, helpPriority: { gte: 2 } } }),
    prisma.whatsAppChat.findMany({
      where: { tenantId, assignedToId: userId, helpAssignedAt: { gte: since }, helpTakenAt: null },
      select: { id: true, pushName: true, remoteJid: true, helpReason: true, helpPriority: true, helpAssignedAt: true },
      orderBy: { helpAssignedAt: "desc" },
      take: 10,
    }),
  ]);

  const assignments: AssignmentView[] = assigned
    .filter((chat) => chat.helpAssignedAt !== null)
    .map((chat) => ({
      id: chat.id,
      contact: contactLabel(chat.pushName, chat.remoteJid),
      reason: chat.helpReason,
      priority: chat.helpPriority,
      assignedAt: (chat.helpAssignedAt as Date).toISOString(),
    }));

  return Response.json({ open, high, mine: mineCount, mineHigh, assignments });
}
