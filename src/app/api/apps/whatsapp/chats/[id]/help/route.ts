// src/app/api/apps/whatsapp/chats/[id]/help/route.ts
// POST: The team acts on a chat that needs help. `action`: "take" (I am in charge, the escalation stops),
// "resolve" (handled) or "assign" (the owner puts an assistant in charge, `assigneeId` null leaves it unassigned).
// The tenant and the person come from the session, never from the body.
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { assignPatch, canAssignHelp, resolvePatch, resumeBotPatch, takePatch } from "@/lib/help-actions";

const CHAT_SELECT = {
  id: true,
  botEnabled: true,
  botPausedReason: true,
  helpReason: true,
  helpPriority: true,
  helpRequestedAt: true,
  helpTakenAt: true,
  assignedToId: true,
} as const;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requirePermission("whatsapp.chats");
  if (!access.ok) return access.response;
  const { tenantId, session } = access;
  const userId = session.user.id;
  if (!userId) return apiError("unauthorized", 401);

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "take" && action !== "resolve" && action !== "assign") {
    return apiError("whatsapp_invalid_body", 400);
  }

  const chat = await prisma.whatsAppChat.findFirst({ where: { id: params.id, tenantId }, select: { id: true, botEnabled: true, botPausedReason: true } });
  if (!chat) return apiError("whatsapp_chat_not_found", 404);

  let data: Record<string, unknown>;
  let warning: string | null = null;
  if (action === "take") {
    data = takePatch(userId, new Date(), chat.botEnabled);
  } else if (action === "resolve") {
    // Handled: if the hand-off is what paused the bot, the bot answers this contact again.
    data = { ...resolvePatch(), ...resumeBotPatch(chat.botPausedReason) };
  } else {
    if (!canAssignHelp(access.role)) return apiError("forbidden", 403);
    const assigneeId = body?.assigneeId;
    if (assigneeId !== null && typeof assigneeId !== "string") return apiError("whatsapp_invalid_body", 400);
    if (assigneeId !== null) {
      // Only an active assistant of this business can be put in charge.
      const assistant = await prisma.user.findFirst({
        where: { id: assigneeId, tenantId, role: "STAFF", isActive: true },
        select: { id: true, whatsappNumber: true },
      });
      if (!assistant) return apiError("user_not_found", 404);
      // Assigned without a WhatsApp number: the in-app notice still reaches them, but the WhatsApp reminder cannot.
      // The answer says so, so the owner sees it at once.
      if (!assistant.whatsappNumber) warning = "assignee_no_whatsapp";
    }
    data = assignPatch(assigneeId, new Date());
  }

  const updated = await prisma.whatsAppChat.update({ where: { id: chat.id }, data, select: CHAT_SELECT });
  return Response.json({ chat: updated, warning });
}
