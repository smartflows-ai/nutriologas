// src/app/api/internal/whatsapp/sync/route.ts
import { prisma } from "@/lib/db";
import { ownerTookOverPatch, resolvePatch } from "@/lib/help-actions";
import { isOptOut } from "@/lib/wa-optout";
import { messageContentOf } from "@/lib/wa-message-content";
import { fetchMediaAtArrival, mediaEnabledFor, noteMediaFromSync } from "@/lib/wa-media-data";
import { OPTED_OUT_PAUSE } from "@/lib/help-actions";
import { raiseHelpOnChat, type HelpChatRow, type HelpTenant } from "@/lib/help-requests";
import { HELP_CHAT_SELECT, HELP_TENANT_SELECT, realHelpDeps } from "@/lib/help-data";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-internal-key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    let body = await req.json();
    
    // Si n8n manda un array [ { instance, data } ], tomamos el primer elemento
    if (Array.isArray(body)) {
      body = body[0];
    }

    const { instance, data } = body;
    if (!instance || !data || typeof data !== 'object') {
      return Response.json({ error: "Payload invalido o incompleto", received: body }, { status: 400 });
    }

    // Validar estructura mínima de Evolution
    if (!data.key || !data.key.remoteJid) {
      return Response.json({ error: "Estructura de data.key.remoteJid no encontrada" }, { status: 400 });
    }

    // Extraer tenantId del nombre de la instancia (ej. slug-UUID)
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = instance.match(uuidRegex);
    const tenantId = match ? match[0] : instance; // Fallback a instance completa si no hay match

    // One chat per contact: when Evolution gives the phone JID next to an @lid key, store under the phone JID.
    const alt = data.key.remoteJidAlt;
    const remoteJid = typeof alt === "string" && alt.endsWith("@s.whatsapp.net") ? alt : data.key.remoteJid;
    const fromMe = !!data.key.fromMe;
    const keyId = data.key.id;
    if (!keyId) return Response.json({ error: "Falta ID del mensaje (key.id)" }, { status: 400 });

    const pushName = data.pushName || null;
    const timestamp = data.messageTimestamp ? new Date(data.messageTimestamp * 1000) : new Date();

    // Extraer contenido del mensaje
    const content = messageContentOf(data.message);

    // A bot reply to a patient who opted out was blocked by the send route and never delivered: it is not stored, so
    // the chat history and the last message do not show it (QA 2026-11-20).
    if (fromMe && keyId.startsWith("bot-")) {
      const existing = await prisma.whatsAppChat.findUnique({
        where: { tenantId_remoteJid: { tenantId, remoteJid } },
        select: { optedOutAt: true },
      });
      if (existing?.optedOutAt) return Response.json({ ok: true, skipped: "opted_out" });
    }

    // 1. Asegurar que el Chat existe (o actualizarlo)
    const chat = await (prisma as any).whatsAppChat.upsert({
      where: {
        tenantId_remoteJid: { tenantId, remoteJid }
      },
      update: {
        pushName: fromMe ? undefined : pushName, // No sobrescribir pushName si nosotros mandamos el mensaje
        lastMessage: content,
        updatedAt: timestamp,
      },
      create: {
        tenantId,
        remoteJid,
        pushName: fromMe ? null : pushName,
        lastMessage: content,
        updatedAt: timestamp,
      }
    });

    // A customer who writes again while a person is needed and nobody took the chat: the panel says so.
    if (!fromMe && !data.message?.reactionMessage && chat.helpPriority > 0 && !chat.helpTakenAt) {
      await (prisma as any).whatsAppChat.update({ where: { id: chat.id }, data: { helpCustomerWroteAt: timestamp } });
    }

    // Opt-out (ban prevention): the customer asked to stop. Record it, so proactive messages (reminders,
    // confirmations) skip them, and turn the bot off for this contact. A later message never re-enables it;
    // only an explicit new consent does. The chat also lands in "Necesitan ayuda" (reason opted_out), so a person
    // reads it: a detection can be wrong, and only "Reactivar mensajes" (after confirming with the patient) lifts it.
    if (!fromMe && !chat.optedOutAt && isOptOut(content)) {
      const optedOut = await prisma.whatsAppChat.update({
        where: { id: chat.id },
        data: { optedOutAt: timestamp, optedOutSource: "inbound_keyword", botEnabled: false, botPausedReason: OPTED_OUT_PAUSE },
        select: HELP_CHAT_SELECT,
      });
      const helpTenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: HELP_TENANT_SELECT });
      if (helpTenant) {
        await raiseHelpOnChat(realHelpDeps, helpTenant as HelpTenant, optedOut as HelpChatRow, "opted_out", new Date()).catch(
          (error: unknown) => console.error("[whatsapp/sync] opt-out help request failed", error instanceof Error ? error.name : "error"),
        );
      }
    }

    // 2. Guardar el Mensaje.
    // Messages the owner sends (from the phone) pause the bot for this contact. Bot replies do not:
    // the bot stores its reply under a "bot-" key before sending, and Evolution's echo of that reply
    // (a different key) is matched by content in the same chat within the last minute.
    const isBotRecord = fromMe && keyId.startsWith("bot-");
    let isEcho = false;
    if (fromMe && !isBotRecord) {
      const alreadyStored = await prisma.whatsAppMessage.findUnique({
        where: { tenantId_keyId: { tenantId, keyId } },
        select: { id: true },
      });
      // A bot reply is stored under the phone JID, while an @lid contact's echo arrives under the raw JID.
      // Match on either JID of this contact.
      const contactJids = [remoteJid, data.key.remoteJidAlt].filter(
        (jid): jid is string => typeof jid === "string" && jid.includes("@")
      );
      const botRecord = alreadyStored
        ? null
        : await (prisma as any).whatsAppMessage.findFirst({
            where: {
              tenantId,
              remoteJid: { in: contactJids },
              fromMe: true,
              keyId: { startsWith: "bot-" },
              content,
              timestamp: { gte: new Date(Date.now() - 60_000) },
            },
            select: { id: true },
          });
      isEcho = !!alreadyStored || !!botRecord;
    }
    // A reaction is not a written message, so it never pauses the bot.
    const isReaction = !!data.message?.reactionMessage;
    const ownerWroteToContact = fromMe && !isBotRecord && !isEcho && !isReaction;

    // #182: the row of a file noted below; its download runs last, after every write of the chat's state.
    let mediaId: string | null = null;
    if (!isEcho) {
      // One row per business and WhatsApp id (a retry does nothing). Until 35-message-key-drop-global is applied,
      // the old global index can still refuse a message another business stored: log it, keep the sync going.
      const stored = await prisma.whatsAppMessage
        .upsert({
          where: { tenantId_keyId: { tenantId, keyId } },
          update: {},
          create: {
            chatId: chat.id,
            tenantId,
            remoteJid,
            keyId,
            content,
            fromMe,
            timestamp,
            type: data.message?.imageMessage ? "image" : "text",
          },
          select: { id: true },
        })
        .catch((error: unknown) => {
          if ((error as { code?: string })?.code !== "P2002") throw error;
          console.warn("[whatsapp/sync] message id already stored by another business; skipped until migration 35");
          return null;
        });

      // #182: the file a message carries gets its row (only for businesses that are on). Only its shape is read,
      // never the file: a base64 in the event is not stored. A failure here never breaks the sync of the message.
      if (stored && mediaEnabledFor(tenantId)) {
        mediaId = await noteMediaFromSync({ tenantId, chatId: chat.id, messageId: stored.id, keyId, fromMe, message: data.message, receivedAt: timestamp })
          .catch((error: unknown) => {
            console.error("[whatsapp/sync] media row failed", error instanceof Error ? error.name : "error");
            return null;
          });
      }
    }

    if (ownerWroteToContact && chat.botEnabled) {
      await (prisma as any).whatsAppChat.update({
        where: { id: chat.id },
        data: { botEnabled: false, botPausedReason: "owner_reply" },
      });
    }

    // A person answering from their phone means the chat was taken care of; any reply (the bot's included) ends an
    // "unanswered" help request, because its cause is gone.
    const replied = fromMe && !isEcho && !isReaction;
    if (replied && chat.helpPriority > 0 && (ownerWroteToContact || String(chat.helpReason ?? "").startsWith("unanswered"))) {
      await (prisma as any).whatsAppChat.update({
        where: { id: chat.id },
        // A person writing into a chat paused by a hand-off: it stays paused, as "a person is writing".
        data: { ...resolvePatch(), ...(ownerWroteToContact && !chat.botEnabled ? ownerTookOverPatch(chat.botPausedReason) : {}) },
      });
    }

    // 3. Loop guard: si el bot ya envió ≥3 mensajes a este JID en los últimos 60s,
    //    asumimos un loop runaway y dejamos de responder.
    let shouldRespond = true;
    let loopReason: string | null = null;

    if (!fromMe) {
      const cutoff = new Date(Date.now() - 60_000);

      const recentBotMessages = await (prisma as any).whatsAppMessage.count({
        where: {
          tenantId,
          remoteJid,
          fromMe: true,
          timestamp: { gte: cutoff },
        },
      });

      if (recentBotMessages >= 3) {
        shouldRespond = false;
        loopReason = `loop_detected: ${recentBotMessages} bot messages in last 60s`;
        console.warn(`[whatsapp/sync] Loop guard triggered for ${remoteJid} — ${loopReason}`);
      }
    }

    // #182, LAST: a light file is fetched right away, inside one deadline (INLINE_DEADLINE_MS, 6 s for the whole
    // attempt). Everything above (the bot pause when the owner writes, the end of a help request, the loop guard) is
    // already written, so a slow download or a cut request never puts them at risk. A heavier file, or one that does
    // not make it, waits for the 15-minute round. A failure here never breaks the sync.
    if (mediaId) {
      await fetchMediaAtArrival(mediaId)
        .catch((error: unknown) => console.error("[whatsapp/sync] media fetch failed", error instanceof Error ? error.name : "error"));
    }

    return Response.json({ success: true, chatId: chat.id, shouldRespond, loopReason });
  } catch (error: any) {
    console.error("Error syncing WhatsApp message:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
