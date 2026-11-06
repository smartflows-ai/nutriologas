// src/lib/platform-whatsapp.ts
// Sends WhatsApp messages from NewAigent's own line (the platform instance), not from a tenant's line.
// Used for account messages such as the owner's password reset code. It never reads a tenant.
import { formatWhatsAppNumber } from "@/lib/whatsapp";

export interface SendPlatformWhatsAppParams {
  to: string;
  text: string;
}

export interface SendPlatformWhatsAppResult {
  success: boolean;
  reason?: string;
}

// Returns the platform instance name, or null when it is not configured.
export function platformInstanceName(): string | null {
  const name = process.env.PLATFORM_WA_INSTANCE?.trim();
  return name ? name : null;
}

export async function sendPlatformWhatsAppMessage({ to, text }: SendPlatformWhatsAppParams): Promise<SendPlatformWhatsAppResult> {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = platformInstanceName();

  if (!baseUrl || !apiKey || !instance) {
    console.warn("[platform-whatsapp] EVOLUTION_API_URL, EVOLUTION_API_KEY or PLATFORM_WA_INSTANCE not configured");
    return { success: false, reason: "not_configured" };
  }

  const recipient = formatWhatsAppNumber(to);
  if (!recipient || recipient.length < 8) {
    return { success: false, reason: "invalid_number" };
  }

  try {
    const res = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: recipient, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // Log the status only; the body can echo the message text or the number.
      console.error("[platform-whatsapp] send failed, status", res.status);
      return { success: false, reason: "provider_error" };
    }
    return { success: true };
  } catch (error) {
    console.error("[platform-whatsapp] send error", error instanceof Error ? error.name : "unknown");
    return { success: false, reason: "network_error" };
  }
}
