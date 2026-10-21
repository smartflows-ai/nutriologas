// src/lib/whatsapp.ts
// Centralized helper for sending WhatsApp notifications through Evolution API
import { prisma } from "@/lib/db";
import https from "https";

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

function evoFetch(url: string, init?: RequestInit) {
  return fetch(url, { ...(init ?? {}), ...(({ agent: insecureAgent }) as any) });
}

export function formatWhatsAppNumber(phone: string): string {
  // Strip all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If 10 digits (Mexican standard mobile without country code), prepend 521
  if (cleaned.length === 10) {
    cleaned = `521${cleaned}`;
  }
  // If starts with 52 and has 12 digits (e.g. 529991234567), ensure WhatsApp mobile prefix 521
  else if (cleaned.startsWith("52") && cleaned.length === 12 && !cleaned.startsWith("521")) {
    cleaned = `521${cleaned.slice(2)}`;
  }

  return cleaned;
}

export interface SendWhatsAppParams {
  tenantId: string;
  to: string;
  text: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  reason?: string;
  data?: any;
}

export async function sendWhatsAppMessage({
  tenantId,
  to,
  text,
}: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  try {
    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.warn("[whatsapp] EVOLUTION_API_URL or EVOLUTION_API_KEY not configured");
      return { success: false, reason: "Evolution API no está configurado en las variables de entorno" };
    }

    const app = await prisma.connectedApp.findFirst({
      where: { tenantId, provider: "WHATSAPP" },
      select: { waInstanceId: true, waStatus: true },
    });

    if (!app || !app.waInstanceId) {
      return { success: false, reason: "WhatsApp no está conectado para este negocio" };
    }

    // A full JID (contact chats, including @lid contacts) is sent as-is; a phone number is normalized.
    const isJid = to.includes("@");
    const recipient = isJid ? to.trim() : formatWhatsAppNumber(to);
    if (!recipient || (!isJid && recipient.length < 8)) {
      return { success: false, reason: "Número de teléfono inválido" };
    }

    const url = `${EVOLUTION_API_URL}/message/sendText/${app.waInstanceId}`;
    const res = await evoFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: recipient,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[whatsapp] Evolution API error sending message:", res.status, errText);
      return { success: false, reason: `Error Evolution API (${res.status}): ${errText}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error: any) {
    console.error("[whatsapp] Unexpected error sending WhatsApp message:", error);
    return { success: false, reason: error.message || "Error al enviar mensaje por WhatsApp" };
  }
}

/**
 * Best-effort alert to the tenant owner, sent to the business's own connected
 * WhatsApp number (Tenant.whatsappNumber). Used for system alerts (credits
 * exhausted, bot failures) — there is no other notification channel today.
 * Never throws; a missing number or a failed send is only logged.
 */
export async function notifyTenantOwner(tenantId: string, message: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappNumber: true },
  });

  if (!tenant?.whatsappNumber) {
    console.error(`[whatsapp] notifyTenantOwner: tenant ${tenantId} has no whatsappNumber`);
    return;
  }

  const result = await sendWhatsAppMessage({ tenantId, to: tenant.whatsappNumber, text: message });
  if (!result.success) {
    console.error(`[whatsapp] notifyTenantOwner failed for tenant ${tenantId}:`, result.reason);
  }
}
