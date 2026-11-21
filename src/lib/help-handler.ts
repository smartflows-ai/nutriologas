// src/lib/help-handler.ts
// The internal route logic shared by bot/handoff (a purchase, the default reason) and bot/help (any reason n8n sends):
// find the contact's chat, pause the bot when the reason needs a person, and raise the help request.
// Auth: x-internal-key. The tenant comes from the WhatsApp instance, never from the body.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contactJids, isInternalKeyValid, normalizeCustomerPhone, resolveBotTenant } from "@/lib/bot";
import { isHelpReason, isTenantWide, pausesBot, type HelpReason } from "@/lib/help-reasons";
import { shouldAlertOwner } from "@/lib/owner-alert";
import { raiseHelpOnChat, type HelpChatRow, type HelpTenant } from "@/lib/help-requests";
import { HELP_CHAT_SELECT, HELP_TENANT_SELECT, realHelpDeps } from "@/lib/help-data";
import { personRequestAllowed } from "@/lib/help-person-check";

// Reasons only the server raises. "opted_out" comes from the inbound detection in whatsapp/sync, which also records
// the opt-out; raised by the bot it would show "Pidió no recibir mensajes" without any opt-out behind it (QA 2026-11-20).
const SERVER_ONLY_REASONS: ReadonlySet<HelpReason> = new Set<HelpReason>(["opted_out"]);

/** Latest chat lines read to check a person_requested call: enough for one batched turn of the flow. */
const RECENT_LINES = 10;

export async function handleHelpRequest(req: NextRequest, defaultReason: HelpReason | null): Promise<Response> {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, customerPhone, remoteJid, remoteJidAlt, reason: rawReason } = await req.json().catch(() => ({}));
  const reason = rawReason === undefined || rawReason === null || rawReason === "" ? defaultReason : rawReason;
  if (!isHelpReason(reason) || SERVER_ONLY_REASONS.has(reason)) return Response.json({ error: "reason_invalid" }, { status: 400 });

  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  const digits =
    normalizeCustomerPhone(remoteJid, remoteJidAlt) ??
    (customerPhone ? String(customerPhone).replace(/\D/g, "") : null);
  const jids = contactJids(digits, remoteJid, remoteJidAlt);
  const chats = jids.length
    ? await prisma.whatsAppChat.findMany({
        where: { tenantId: bot.tenantId, remoteJid: { in: jids } },
        select: { ...HELP_CHAT_SELECT, botEnabled: true },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  if (chats.length === 0) return Response.json({ raised: false, reason: "no_chat" });

  // Ticket #129: "the customer asked for a person" is believed only when their latest messages say so; otherwise the
  // bot keeps the chat and nobody is told. Read before anything is paused.
  if (reason === "person_requested") {
    const lines = await prisma.whatsAppMessage.findMany({
      where: { tenantId: bot.tenantId, chatId: { in: chats.map((chat) => chat.id) } },
      orderBy: { timestamp: "desc" },
      take: RECENT_LINES,
      select: { fromMe: true, content: true },
    });
    if (!personRequestAllowed(reason, lines)) return Response.json({ raised: false, reason: "not_requested" });
  }

  // The bot steps aside for every chat row of this contact when a person has to take over.
  let paused = false;
  if (pausesBot(reason)) {
    const on = chats.filter((chat) => chat.botEnabled).map((chat) => chat.id);
    if (on.length > 0) {
      await prisma.whatsAppChat.updateMany({
        where: { tenantId: bot.tenantId, id: { in: on } },
        data: { botEnabled: false, botPausedReason: reason },
      });
      paused = true;
    }
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: bot.tenantId }, select: HELP_TENANT_SELECT });
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });
  const { botEnabled: _botEnabled, ...row } = chats[0];
  const now = new Date();

  // A problem that hits the whole business (a send failure, credits) is told once per hour, not once per chat.
  let quiet = false;
  if (isTenantWide(reason)) {
    const recent = await prisma.whatsAppChat.aggregate({
      where: { tenantId: bot.tenantId, helpReason: reason, id: { not: row.id } },
      _max: { helpAssigneeNotifiedAt: true, helpOwnerNotifiedAt: true },
    });
    const times = [recent._max.helpAssigneeNotifiedAt, recent._max.helpOwnerNotifiedAt].filter((time): time is Date => time !== null);
    const lastNotice = times.length > 0 ? new Date(Math.max(...times.map((time) => time.getTime()))) : null;
    quiet = !shouldAlertOwner(now, lastNotice);
  }

  const outcome = await raiseHelpOnChat(realHelpDeps, tenant as HelpTenant, row as HelpChatRow, reason, now, { quiet });
  return Response.json({ raised: outcome.raised, paused, notified: outcome.notified });
}
