// src/app/api/internal/whatsapp/send/route.ts
// Ban prevention: the bot's replies go through the messaging service too (policy, kill switches, breaker, audit).
// n8n calls this instead of the Evolution sendText node. Tenant comes from the instance, never from the body.
// The purpose is fixed to CUSTOMER_REPLY: a reply inside a conversation the customer started.
import { isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const instance = typeof body?.instance === "string" ? body.instance : null;
  const to = typeof body?.to === "string" ? body.to : null;
  const text = typeof body?.text === "string" ? body.text : null;
  if (!instance || !to || !text) return Response.json({ error: "instance, to y text son requeridos" }, { status: 400 });

  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  // The bot stores its reply under a "bot-" key before sending: that key is the idempotency key, so a retry of the
  // same reply is never delivered twice.
  const messageKey = typeof body?.messageKey === "string" && body.messageKey.startsWith("bot-") ? body.messageKey : undefined;
  const result = await sendWhatsAppMessage({
    tenantId: bot.tenantId,
    to,
    text,
    purpose: "CUSTOMER_REPLY",
    idempotencyKey: messageKey ? `${messageKey}` : undefined,
  });
  return Response.json({ success: result.success, reason: result.reason ?? null }, { status: result.success ? 200 : 502 });
}
