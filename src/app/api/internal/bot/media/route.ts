// src/app/api/internal/bot/media/route.ts
// POST: the workflow tells the app a patient sent a file (audio, image, video or document) the bot cannot read (#139).
// The app marks the chat as needing the team (reason unsupported_media, which pauses the bot until a person marks it
// handled) and returns the answer
// to send, or `ignore` for a type that stays silent or a second file in the same burst. It never receives the file:
// only the message type. Auth: x-internal-key. The tenant comes from the WhatsApp instance, never from the body.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contactJids, isInternalKeyValid, normalizeCustomerPhone, resolveBotTenant } from "@/lib/bot";
import { isTeamNumber } from "@/lib/team-numbers";
import { loadTeamNumbers } from "@/lib/team-numbers-data";
import { raiseHelpForContact } from "@/lib/help-handler";
import { MEDIA_REPLY_COOLDOWN_MINUTES, classifyInbound, mediaGate, mediaReplyText, shouldReplyToMedia } from "@/lib/unsupported-media";
import { mediaEnabledFor } from "@/lib/wa-media-data";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, remoteJid, remoteJidAlt, messageType } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  if (classifyInbound(messageType) === "silent") return Response.json({ action: "ignore" });

  // The guards of the normal flow, which this branch leaves behind: a person of the business, a chat where the bot is
  // off and a contact who opted out get no answer and no flag. The file is stored by whatsapp/sync either way.
  const digits = normalizeCustomerPhone(remoteJid, remoteJidAlt);
  const jids = contactJids(digits, remoteJid, remoteJidAlt);
  const [teamNumbers, chats] = await Promise.all([
    loadTeamNumbers(bot.tenantId),
    jids.length > 0
      ? prisma.whatsAppChat.findMany({ where: { tenantId: bot.tenantId, remoteJid: { in: jids } }, select: { botEnabled: true, optedOutAt: true } })
      : Promise.resolve([]),
  ]);
  const gate = mediaGate({
    isTeam: isTeamNumber(digits, teamNumbers),
    botEnabled: chats.every((chat) => chat.botEnabled),
    optedOut: chats.some((chat) => chat.optedOutAt !== null),
  });
  if (gate === "ignore") return Response.json({ action: "ignore" });

  // Raised first, so a second file that arrives a moment later already sees the request and stays quiet. A failure
  // here never leaves the patient without an answer.
  let result: Awaited<ReturnType<typeof raiseHelpForContact>> | null = null;
  try {
    result = await raiseHelpForContact(bot, { remoteJid, remoteJidAlt }, "unsupported_media");
  } catch (error) {
    console.error("unsupported_media hand-off failed", error);
  }

  const reply = mediaReplyText(bot.messageLanguage, bot.tenantName, { storesFiles: mediaEnabledFor(bot.tenantId), privacyUrl: bot.privacyUrl });
  const now = new Date();
  const done = result && result.status === "done" ? result : null;
  const recent =
    done && done.chatIds.length > 0
      ? await prisma.whatsAppMessage.findFirst({
          where: {
            tenantId: bot.tenantId,
            chatId: { in: done.chatIds },
            fromMe: true,
            content: reply,
            timestamp: { gte: new Date(now.getTime() - MEDIA_REPLY_COOLDOWN_MINUTES * 60_000) },
          },
          select: { id: true },
        })
      : null;

  const send = shouldReplyToMedia(
    { helpReason: done?.before.helpReason ?? null, helpRequestedAt: done?.before.helpRequestedAt ?? null, hasRecentReply: recent !== null },
    now,
  );
  return Response.json(send ? { action: "reply", reply } : { action: "ignore" });
}
