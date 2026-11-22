// src/app/api/internal/bot/contact-status/route.ts
// POST: Is the AI bot allowed to answer this contact? n8n calls it before the agent runs.
// A contact with no chat yet is answered (the bot is on by default).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contactJids, isInternalKeyValid, normalizeCustomerPhone, resolveBotTenant } from "@/lib/bot";
import { isTeamNumber } from "@/lib/team-numbers";
import { loadTeamNumbers } from "@/lib/team-numbers-data";
import { detectRunaway } from "@/lib/wa-loop-guard";
import { notifyTenantOwner } from "@/lib/whatsapp";

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

  // The people of the business (the owner and the staff) are never answered as customers: an assistant who
  // replies to a help notice on the business number would otherwise get the bot's reply.
  if (isTeamNumber(digits, await loadTeamNumbers(bot.tenantId))) {
    return Response.json({ botEnabled: false, reason: "team_member" });
  }

  // Ban prevention (B0): a conversation that runs like an automated loop pauses the bot for that contact only.
  // The owner is told once, when the pause happens; the bot comes back only from the chat (mark handled or turn on).
  const now = Date.now();
  const recent = await prisma.whatsAppMessage.findMany({
    where: { tenantId: bot.tenantId, remoteJid: { in: jids }, timestamp: { gte: new Date(now - 60 * 60 * 1000) } },
    select: { timestamp: true, fromMe: true },
    take: 500,
  });
  const verdict = detectRunaway(
    recent.map((m) => ({ atMs: m.timestamp.getTime(), fromMe: m.fromMe })),
    now
  );
  if (verdict.paused) {
    const paused = await prisma.whatsAppChat.updateMany({
      where: { tenantId: bot.tenantId, remoteJid: { in: jids }, botEnabled: true },
      data: { botEnabled: false, botPausedReason: "loop_guard" },
    });
    if (paused.count > 0) {
      await notifyTenantOwner(
        bot.tenantId,
        "Pausé el asistente para un contacto porque su conversación parece automática (muchos mensajes seguidos). Revísalo en Chats; puedes volver a activar el asistente desde ese chat."
      );
    }
    return Response.json({ botEnabled: false, reason: "loop_guard" });
  }

  // A contact can have more than one chat row. If any of them is paused, the bot stays off for this contact only.
  const chats = await prisma.whatsAppChat.findMany({
    where: { tenantId: bot.tenantId, remoteJid: { in: jids } },
    select: { botEnabled: true },
  });

  return Response.json({ botEnabled: chats.every((chat) => chat.botEnabled) });
}
