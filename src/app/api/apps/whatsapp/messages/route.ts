// src/app/api/apps/whatsapp/messages/route.ts
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { mediaEnabledFor, mediaSummariesFor } from "@/lib/wa-media-data";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const access = await requirePermission("whatsapp.chats");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) return Response.json({ error: "chatId es requerido" }, { status: 400 });

  try {
    // Newest 50 messages, returned oldest-first so the chat reads top to bottom.
    const newest = await prisma.whatsAppMessage.findMany({
      where: { chatId, tenantId },
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    // Each message carries the summary of its file (#182): kind, status, name, size as a number, never a link.
    // A business that is off never reads the file tables: the chat shows only the marker, as before.
    const media = mediaEnabledFor(tenantId) ? await mediaSummariesFor(tenantId, newest.map((message) => message.id)) : new Map();
    const messages = newest.reverse().map((message) => ({ ...message, media: media.get(message.id) ?? null }));
    return Response.json({ messages });
  } catch (error: any) {
    console.error("Error loading WhatsApp messages:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
