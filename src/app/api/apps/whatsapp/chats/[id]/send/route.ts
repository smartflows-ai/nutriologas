// src/app/api/apps/whatsapp/chats/[id]/send/route.ts
// POST: The owner writes to a contact from the CRM. The message goes out through the tenant's
// WhatsApp connection, is stored in the chat, and pauses the AI bot for that contact.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const MAX_LENGTH = 4096;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return apiError("unauthorized", 401);
  }

  const tenantId = (session.user as any).tenantId as string;
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return apiError("whatsapp_message_required", 400);
  if (text.length > MAX_LENGTH) return apiError("whatsapp_invalid_body", 400);

  const chat = await prisma.whatsAppChat.findFirst({
    where: { id: params.id, tenantId },
    select: { id: true, remoteJid: true, botEnabled: true },
  });
  if (!chat) return apiError("whatsapp_chat_not_found", 404);

  // Phone chats keep the digits path that already works. @lid chats (no phone) send the full JID.
  const recipient = chat.remoteJid.endsWith("@s.whatsapp.net")
    ? chat.remoteJid.split("@")[0]
    : chat.remoteJid;
  const sent = await sendWhatsAppMessage({ tenantId, to: recipient, text });
  if (!sent.success) {
    console.error("[whatsapp/send] Owner message failed:", sent.reason);
    return apiError("whatsapp_send_failed", 502);
  }

  // Evolution's echo of this message may reach the sync route first. The upsert keeps one row per key.
  const keyId = sent.data?.key?.id ?? `owner-${Date.now()}`;
  const message = await prisma.whatsAppMessage.upsert({
    where: { keyId },
    update: {},
    create: {
      chatId: chat.id,
      tenantId,
      remoteJid: chat.remoteJid,
      keyId,
      content: text,
      fromMe: true,
      type: "text",
    },
    select: { id: true, content: true, fromMe: true, timestamp: true },
  });

  // Writing to a contact pauses the bot, so it does not answer over the owner.
  const updatedChat = await prisma.whatsAppChat.update({
    where: { id: chat.id },
    data: {
      lastMessage: text,
      ...(chat.botEnabled ? { botEnabled: false, botPausedReason: "owner_reply" } : {}),
    },
    select: { id: true, botEnabled: true, botPausedReason: true },
  });

  return Response.json({ message, chat: updatedChat });
}
