// src/app/api/apps/whatsapp/messages/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) return Response.json({ error: "chatId es requerido" }, { status: 400 });

  try {
    const messages = await prisma.whatsAppMessage.findMany({
      where: { chatId, tenantId },
      orderBy: { timestamp: "asc" },
      take: 50, // Solo los últimos 50 para empezar
    });

    return Response.json({ messages });
  } catch (error: any) {
    console.error("Error loading WhatsApp messages:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
