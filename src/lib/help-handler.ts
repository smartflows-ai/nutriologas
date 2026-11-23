// src/lib/help-handler.ts
// The internal route logic shared by bot/handoff (a purchase, the default reason) and bot/help (any reason n8n sends):
// find the contact's chat, pause the bot when the reason needs a person, and raise the help request.
// Auth: x-internal-key. The tenant comes from the WhatsApp instance, never from the body.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contactJids, isInternalKeyValid, normalizeCustomerPhone, resolveBotTenant, type BotTenant } from "@/lib/bot";
import { isHelpReason, isTenantWide, pausesBot, type HelpReason } from "@/lib/help-reasons";
import { shouldAlertOwner } from "@/lib/owner-alert";
import { raiseHelpOnChat, type HelpChatRow, type HelpTenant } from "@/lib/help-requests";
import { HELP_CHAT_SELECT, HELP_TENANT_SELECT, realHelpDeps } from "@/lib/help-data";
import { personRequestAllowed } from "@/lib/help-person-check";
import { alreadyOpenBody, alreadyRaisedBody, requestAlreadyOpen, serverReasonOpen } from "@/lib/help-already-raised";

// Reasons only the server raises. "opted_out" comes from the inbound detection in whatsapp/sync, which also records
// the opt-out; raised by the bot it would show "Pidió no recibir mensajes" without any opt-out behind it (QA 2026-11-20).
// "booking_limit" is raised by bot/book and bot/reschedule when the daily visit limit is reached (#141), and
// "unsupported_media" by bot/media when a patient sends a file the bot cannot read (#139): not by the model.
const SERVER_ONLY_REASONS: ReadonlySet<HelpReason> = new Set<HelpReason>(["opted_out", "booking_limit", "unsupported_media"]);

/** Latest chat lines read to check a person_requested call: enough for one batched turn of the flow. */
const RECENT_LINES = 10;

export async function handleHelpRequest(req: NextRequest, defaultReason: HelpReason | null): Promise<Response> {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, customerPhone, remoteJid, remoteJidAlt, reason: rawReason } = await req.json().catch(() => ({}));
  const reason = rawReason === undefined || rawReason === null || rawReason === "" ? defaultReason : rawReason;
  if (!isHelpReason(reason) || SERVER_ONLY_REASONS.has(reason)) return Response.json({ error: "reason_invalid" }, { status: 400 });

  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  // The model path: a request the server already raised (and is still open) is final (guardServerReasons).
  const result = await raiseHelpForContact(bot, { customerPhone, remoteJid, remoteJidAlt }, reason, { guardServerReasons: true });
  if (result.status === "already_raised") return Response.json(alreadyRaisedBody());
  if (result.status === "no_chat") return Response.json({ raised: false, reason: "no_chat" });
  if (result.status === "not_requested") return Response.json({ raised: false, reason: "not_requested" });
  if (result.status === "tenant_missing") return Response.json({ error: "Tenant not found" }, { status: 404 });
  // Ticket #143: the request was already open (the n8n guard raised it first): say so, instead of a bare raised: false.
  if (result.alreadyOpen) return Response.json(alreadyOpenBody(result.paused));
  return Response.json({ raised: result.raised, paused: result.paused, notified: result.notified });
}

/** Who the help request is about: the contact's phone and the JIDs the webhook sent. */
export interface HelpContact {
  customerPhone?: unknown;
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
}

export type HelpContactResult =
  | { status: "no_chat" }
  | { status: "not_requested" }
  | { status: "already_raised" }
  | { status: "tenant_missing" }
  | {
      status: "done";
      raised: boolean;
      paused: boolean;
      notified: Awaited<ReturnType<typeof raiseHelpOnChat>>["notified"];
      /** The request was already open with this reason or a higher one, so this call changed nothing (ticket #143). */
      alreadyOpen: boolean;
      /** The contact's chat rows and the help state the newest one had before this call (bot/media reads it). */
      chatIds: string[];
      before: { helpReason: string | null; helpRequestedAt: Date | null };
    };

/**
 * Finds the contact's chat, pauses the bot when the reason needs a person and raises the help request. Shared by the
 * internal help routes (the tenant comes from the WhatsApp instance, resolved by the caller) and by the bot routes that
 * raise a reason themselves (booking_limit, #141). Every query is limited to the tenant of `bot`.
 */
export async function raiseHelpForContact(
  bot: BotTenant,
  contact: HelpContact,
  reason: HelpReason,
  options: { guardServerReasons?: boolean } = {},
): Promise<HelpContactResult> {
  const { customerPhone, remoteJid, remoteJidAlt } = contact;
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
  if (chats.length === 0) return { status: "no_chat" };

  // Execution 22960: the server handed the chat over (booking_limit...) and the model asked for help right after. That
  // must not change the reason, the pause or tell the owner again. Only the model path turns the guard on.
  if (options.guardServerReasons && serverReasonOpen(chats, SERVER_ONLY_REASONS)) return { status: "already_raised" };

  // Ticket #129: refused only when the customer's current turn is booking for someone else and has no request, named
  // person or complaint (rule in help-person-check.ts); anything else is accepted. Read before anything is paused.
  if (reason === "person_requested") {
    const lines = await prisma.whatsAppMessage.findMany({
      where: { tenantId: bot.tenantId, chatId: { in: chats.map((chat) => chat.id) } },
      orderBy: { timestamp: "desc" },
      take: RECENT_LINES,
      select: { fromMe: true, content: true },
    });
    if (!personRequestAllowed(reason, lines)) return { status: "not_requested" };
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
  if (!tenant) return { status: "tenant_missing" };
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

  // Read before raising: true when the request is already open with this reason or a higher one.
  const alreadyOpen = requestAlreadyOpen(
    { reason: isHelpReason(row.helpReason) ? row.helpReason : null, priority: row.helpPriority, requestedAt: row.helpRequestedAt },
    reason,
    now,
  );
  const outcome = await raiseHelpOnChat(realHelpDeps, tenant as HelpTenant, row as HelpChatRow, reason, now, { quiet });
  return {
    status: "done",
    raised: outcome.raised,
    paused,
    notified: outcome.notified,
    alreadyOpen: alreadyOpen && !outcome.raised,
    chatIds: chats.map((chat) => chat.id),
    before: { helpReason: row.helpReason, helpRequestedAt: row.helpRequestedAt },
  };
}
