// src/app/api/apps/whatsapp/chats/[id]/route.ts
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { resolvePatch } from "@/lib/help-actions";
import { destructionRequestForChat } from "@/lib/wa-media-data";

/**
 * Turns the AI bot on or off for one contact. Off means the bot stops answering this chat,
 * while customer messages are still stored.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await requirePermission("whatsapp.bot");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  const body = await req.json().catch(() => null);
  if (typeof body?.botEnabled !== "boolean") {
    return apiError("whatsapp_invalid_body", 400);
  }

  const existing = await prisma.whatsAppChat.findFirst({
    where: { id: params.id, tenantId },
    select: { id: true, optedOutAt: true },
  });
  if (!existing) {
    return apiError("whatsapp_chat_not_found", 404);
  }
  // A patient who asked to stop messages gets the bot back only through "Reactivar mensajes" (help route), which
  // records who confirmed it with the patient (QA 2026-11-20).
  if (body.botEnabled && existing.optedOutAt) {
    return apiError("whatsapp_chat_opted_out", 409);
  }

  const chat = await prisma.whatsAppChat.update({
    where: { id: existing.id },
    data: {
      botEnabled: body.botEnabled,
      botPausedReason: body.botEnabled ? null : "manual",
      // Turning the bot back on means a person finished with this chat: the help request is handled.
      ...(body.botEnabled ? resolvePatch() : {}),
    },
    select: { id: true, botEnabled: true, botPausedReason: true },
  });

  return Response.json({ chat });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const access = await requirePermission("whatsapp.chats.delete");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  const chatId = params.id;

  if (!chatId) {
    return Response.json({ error: "Falta el id del chat" }, { status: 400 });
  }

  try {
    // Verificar que el chat pertenece a este tenant antes de eliminar
    const existing = await prisma.whatsAppChat.findFirst({
      where: { id: chatId, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    // Its files are marked for destruction and lose the person's data in the same transaction (#182); the 15-minute
    // job removes the copies. Then the chat is deleted; its messages go with it (onDelete: Cascade).
    await prisma.$transaction([
      destructionRequestForChat(tenantId, chatId),
      prisma.whatsAppChat.delete({ where: { id: chatId } }),
    ]);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting WhatsApp chat:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
