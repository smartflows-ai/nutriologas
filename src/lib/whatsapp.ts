// src/lib/whatsapp.ts
// Centralized helper for sending WhatsApp notifications. The provider calls live in
// src/lib/messaging/evolution-adapter.ts (TLS validated, timeout, per-instance key).
import { prisma } from "@/lib/db";
import { WA_INVALID_NUMBER, WA_NOT_AVAILABLE, WA_NOT_CONNECTED } from "@/lib/whatsapp-reasons";
import { evolutionConfigFromEnv, instanceKeyOf, sendText } from "@/lib/messaging/evolution-adapter";

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
  // The provider's message id when it returned one; used only to dedupe the echo of a panel send.
  // The raw provider body is never exposed (it can echo the number or the text).
  messageId?: string | null;
}

export async function sendWhatsAppMessage({
  tenantId,
  to,
  text,
}: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  try {
    const cfg = evolutionConfigFromEnv();
    if (!cfg) {
      console.warn("[whatsapp] EVOLUTION_API_URL or EVOLUTION_API_KEY not configured");
      return { success: false, reason: WA_NOT_AVAILABLE };
    }

    const app = await prisma.connectedApp.findFirst({
      where: { tenantId, provider: "WHATSAPP" },
      select: { waInstanceId: true, waStatus: true, accessToken: true },
    });

    if (!app || !app.waInstanceId) {
      return { success: false, reason: WA_NOT_CONNECTED };
    }

    // A full JID (contact chats, including @lid contacts) is sent as-is; a phone number is normalized.
    const isJid = to.includes("@");
    const recipient = isJid ? to.trim() : formatWhatsAppNumber(to);
    if (!recipient || (!isJid && recipient.length < 8)) {
      return { success: false, reason: WA_INVALID_NUMBER };
    }

    const sent = await sendText(cfg, {
      instance: app.waInstanceId,
      apiKey: instanceKeyOf(app.accessToken, cfg.globalKey),
      number: recipient,
      text,
    });

    if (!sent.ok) {
      // Status only: the provider body can echo the number or the text.
      console.error("[whatsapp] send failed:", sent.error, sent.status ?? "");
      return { success: false, reason: WA_NOT_AVAILABLE };
    }

    return { success: true, messageId: sent.messageId };
  } catch (error: unknown) {
    console.error("[whatsapp] Unexpected error sending WhatsApp message:", error instanceof Error ? error.name : "unknown");
    return { success: false, reason: WA_NOT_AVAILABLE };
  }
}

/**
 * Best-effort alert to the tenant owner, sent to the business's own connected
 * WhatsApp number (Tenant.whatsappNumber). Used for system alerts (credits
 * exhausted, bot failures) — there is no other notification channel today.
 * Never throws; a missing number or a failed send is only logged. Returns true only when the message was sent,
 * so a caller that rate-limits alerts can tell whether the owner was actually told.
 */
export async function notifyTenantOwner(tenantId: string, message: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappNumber: true },
  });

  if (!tenant?.whatsappNumber) {
    console.error(`[whatsapp] notifyTenantOwner: tenant ${tenantId} has no whatsappNumber`);
    return false;
  }

  const result = await sendWhatsAppMessage({ tenantId, to: tenant.whatsappNumber, text: message });
  if (!result.success) {
    console.error(`[whatsapp] notifyTenantOwner failed for tenant ${tenantId}:`, result.reason);
  }
  return result.success;
}
