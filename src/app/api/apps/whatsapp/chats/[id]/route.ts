// src/app/api/apps/whatsapp/chats/[id]/route.ts
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";

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
    select: { id: true },
  });
  if (!existing) {
    return apiError("whatsapp_chat_not_found", 404);
  }

  const chat = await prisma.whatsAppChat.update({
    where: { id: existing.id },
    data: {
      botEnabled: body.botEnabled,
      botPausedReason: body.botEnabled ? null : "manual",
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

    // Eliminar el chat. Los mensajes asociados se eliminan en cascada
    // gracias a onDelete: Cascade en WhatsAppMessage.chatId.
    await prisma.whatsAppChat.delete({
      where: { id: chatId },
    });

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting WhatsApp chat:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
