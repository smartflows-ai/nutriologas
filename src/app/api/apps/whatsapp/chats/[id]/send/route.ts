// src/app/api/apps/whatsapp/chats/[id]/send/route.ts
// POST: The owner writes to a contact from the CRM. The message goes out through the tenant's
// WhatsApp connection, is stored in the chat, and pauses the AI bot for that contact.
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { ownerTookOverPatch, repliedPatch } from "@/lib/help-actions";

const MAX_LENGTH = 4096;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await requirePermission("whatsapp.chats");
  if (!access.ok) return access.response;
  const { tenantId, session } = access;
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return apiError("whatsapp_message_required", 400);
  if (text.length > MAX_LENGTH) return apiError("whatsapp_invalid_body", 400);

  const chat = await prisma.whatsAppChat.findFirst({
    where: { id: params.id, tenantId },
    select: { id: true, remoteJid: true, botEnabled: true, botPausedReason: true },
  });
  if (!chat) return apiError("whatsapp_chat_not_found", 404);

  // Phone chats keep the digits path that already works. @lid chats (no phone) send the full JID.
  const recipient = chat.remoteJid.endsWith("@s.whatsapp.net")
    ? chat.remoteJid.split("@")[0]
    : chat.remoteJid;
  // The owner answers a conversation the customer started: a customer reply, no visit consent needed.
  const sent = await sendWhatsAppMessage({ tenantId, to: recipient, text, purpose: "CUSTOMER_REPLY" });
  if (!sent.success) {
    console.error("[whatsapp/send] Owner message failed:", sent.reason);
    return apiError("whatsapp_send_failed", 502);
  }

  // Evolution's echo of this message may reach the sync route first. The upsert keeps one row per key.
  const keyId = sent.messageId ?? `owner-${Date.now()}`;
  const message = await prisma.whatsAppMessage.upsert({
    where: { tenantId_keyId: { tenantId, keyId } },
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
      ...(chat.botEnabled ? { botEnabled: false, botPausedReason: "owner_reply" } : ownerTookOverPatch(chat.botPausedReason)),
      // Answering from the panel is the proof that a person took care of the chat: the help request is handled
      // and the one who answered is in charge of this chat from now on.
      ...(session.user.id ? repliedPatch(session.user.id) : {}),
    },
    select: { id: true, botEnabled: true, botPausedReason: true },
  });

  return Response.json({ message, chat: updatedChat });
}
