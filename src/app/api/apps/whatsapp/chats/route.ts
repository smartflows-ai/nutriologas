// src/app/api/apps/whatsapp/chats/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;

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
      }
    });

    return Response.json({ chats });
  } catch (error: any) {
    console.error("Error loading local WhatsApp chats:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
