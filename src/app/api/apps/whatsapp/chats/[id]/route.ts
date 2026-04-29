// src/app/api/apps/whatsapp/chats/[id]/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;
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
