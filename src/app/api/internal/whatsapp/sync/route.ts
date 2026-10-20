// src/app/api/internal/whatsapp/sync/route.ts
import { prisma } from "@/lib/db";
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
    let content = "";
    if (data.message?.conversation) content = data.message.conversation;
    else if (data.message?.extendedTextMessage?.text) content = data.message.extendedTextMessage.text;
    else if (data.message?.imageMessage?.caption) content = data.message.imageMessage.caption;
    else if (data.message?.audioMessage) content = "[Audio]";
    else if (data.message?.videoMessage) content = "[Video]";
    else if (data.message?.documentMessage) content = "[Documento]";
    else if (data.message?.reactionMessage) {
      const emoji = data.message.reactionMessage.text;
      content = emoji ? `Reacción ${emoji}` : "Reacción eliminada";
    }
    else if (data.message?.stickerMessage) content = "[Sticker]";
    else if (data.message?.locationMessage) content = "[Ubicación]";
    else if (data.message?.contactMessage) content = "[Contacto]";
    else content = "[Mensaje Multimedia]";

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

    // 2. Guardar el Mensaje.
    // Messages the owner sends (from the phone) pause the bot for this contact. Bot replies do not:
    // the bot stores its reply under a "bot-" key before sending, and Evolution's echo of that reply
    // (a different key) is matched by content in the same chat within the last minute.
    const isBotRecord = fromMe && keyId.startsWith("bot-");
    let isEcho = false;
    if (fromMe && !isBotRecord) {
      const alreadyStored = await (prisma as any).whatsAppMessage.findUnique({
        where: { keyId },
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

    if (!isEcho) {
      await (prisma as any).whatsAppMessage.upsert({
        where: { keyId },
        update: {}, // Si ya existe no hacemos nada (evitar duplicados de upsert retry)
        create: {
          chatId: chat.id,
          tenantId,
          remoteJid,
          keyId,
          content,
          fromMe,
          timestamp,
          type: data.message?.imageMessage ? "image" : "text",
        }
      });
    }

    if (ownerWroteToContact && chat.botEnabled) {
      await (prisma as any).whatsAppChat.update({
        where: { id: chat.id },
        data: { botEnabled: false, botPausedReason: "owner_reply" },
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

    return Response.json({ success: true, chatId: chat.id, shouldRespond, loopReason });
  } catch (error: any) {
    console.error("Error syncing WhatsApp message:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
