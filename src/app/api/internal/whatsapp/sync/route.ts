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

    const remoteJid = data.key.remoteJid;
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

    // 2. Guardar el Mensaje
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

    return Response.json({ success: true, chatId: chat.id });
  } catch (error: any) {
    console.error("Error syncing WhatsApp message:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
