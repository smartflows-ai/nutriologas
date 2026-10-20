// src/app/api/internal/bot/contact-status/route.ts
// POST: Is the AI bot allowed to answer this contact? n8n calls it before the agent runs.
// A contact with no chat yet is answered (the bot is on by default).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contactJids, isInternalKeyValid, normalizeCustomerPhone, resolveBotTenant } from "@/lib/bot";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, customerPhone, remoteJid, remoteJidAlt } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  const digits =
    normalizeCustomerPhone(remoteJid, remoteJidAlt) ??
    (customerPhone ? String(customerPhone).replace(/\D/g, "") : null);
  const jids = contactJids(digits, remoteJid, remoteJidAlt);
  if (jids.length === 0) return Response.json({ botEnabled: true });

  // A contact can have more than one chat row. If any of them is paused, the bot stays off for this contact only.
  const chats = await prisma.whatsAppChat.findMany({
    where: { tenantId: bot.tenantId, remoteJid: { in: jids } },
    select: { botEnabled: true },
  });

  return Response.json({ botEnabled: chats.every((chat) => chat.botEnabled) });
}
