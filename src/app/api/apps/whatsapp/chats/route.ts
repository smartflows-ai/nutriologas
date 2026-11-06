// src/app/api/apps/whatsapp/chats/route.ts
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const access = await requirePermission("whatsapp.chats");
  if (!access.ok) return access.response;
  const { tenantId } = access;

  try {
    // Consultar chats guardados localmente
    const chats = await prisma.whatsAppChat.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        remoteJid: true,
        pushName: true,
        lastMessage: true,
        updatedAt: true,
        botEnabled: true,
        botPausedReason: true,
      }
    });

    return Response.json({ chats });
  } catch (error: any) {
    console.error("Error loading local WhatsApp chats:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
