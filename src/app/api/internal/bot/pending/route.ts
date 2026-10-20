// src/app/api/internal/bot/pending/route.ts
// POST: Customer messages that have not been answered yet, and whether this run holds the newest one.
// n8n waits a few seconds after each message. Only the run that holds the newest message answers,
// with all the pending text, so a customer who types in several messages gets one reply.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contactJids, isInternalKeyValid, normalizeCustomerPhone, resolveBotTenant } from "@/lib/bot";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, customerPhone, remoteJid, remoteJidAlt, keyId } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  const digits =
    normalizeCustomerPhone(remoteJid, remoteJidAlt) ??
    (customerPhone ? String(customerPhone).replace(/\D/g, "") : null);
  const jids = contactJids(digits, remoteJid, remoteJidAlt);

  // Every chat row of this contact: messages may be split across them.
  const chats = jids.length
    ? await prisma.whatsAppChat.findMany({
        where: { tenantId: bot.tenantId, remoteJid: { in: jids } },
        select: { id: true, botEnabled: true },
      })
    : [];

  // No stored chat yet: answer the message this run was started for.
  if (chats.length === 0) return Response.json({ isLatest: true, botEnabled: true, text: null });
  // The owner paused this contact while the run was waiting: do not answer.
  if (chats.some((chat) => !chat.botEnabled)) {
    return Response.json({ isLatest: false, botEnabled: false, text: null });
  }

  const chatIds = chats.map((chat) => chat.id);

  // Pending = customer text messages after the last message we sent (bot or owner).
  const lastOutgoing = await prisma.whatsAppMessage.findFirst({
    where: { chatId: { in: chatIds }, fromMe: true },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });
  const inbound = await prisma.whatsAppMessage.findMany({
    where: {
      chatId: { in: chatIds },
      fromMe: false,
      ...(lastOutgoing ? { timestamp: { gt: lastOutgoing.timestamp } } : {}),
    },
    orderBy: { timestamp: "asc" },
    select: { keyId: true, content: true },
  });
  // Reactions and placeholders are not questions; leave them out of the reply input.
  const pending = inbound.filter(
    (m) => !m.content.startsWith("Reacción") && !m.content.startsWith("[")
  );

  // Only text counts: a reaction sent after the question must not cancel the answer.
  const newest = pending[pending.length - 1];
  const isLatest = !newest || newest.keyId === keyId;

  return Response.json({
    isLatest,
    botEnabled: true,
    text: pending.length ? pending.map((m) => m.content).join("\n") : null,
  });
}
