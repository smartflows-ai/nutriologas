// src/lib/platform-whatsapp.ts
// Sends WhatsApp messages from NewAigent's own line (the platform instance), not from a tenant's line.
// Used for account messages such as the owner's password reset code. It never reads a tenant.
import { prisma } from "@/lib/db";
import { formatWhatsAppNumber } from "@/lib/whatsapp";
import { evolutionConfigFromEnv, instanceKeyOf, sendText } from "@/lib/messaging/evolution-adapter";

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
  const cfg = evolutionConfigFromEnv();
  const instance = platformInstanceName();

  if (!cfg || !instance) {
    console.warn("[platform-whatsapp] EVOLUTION_API_URL, EVOLUTION_API_KEY or PLATFORM_WA_INSTANCE not configured");
    return { success: false, reason: "not_configured" };
  }

  const recipient = formatWhatsAppNumber(to);
  if (!recipient || recipient.length < 8) {
    return { success: false, reason: "invalid_number" };
  }

  // Ban prevention: the global kill switch stops the platform line too (set by an operator in platform_flags).
  const flags = await prisma.platformFlag.findUnique({ where: { id: "global" }, select: { globalKillSwitch: true } });
  if (flags?.globalKillSwitch) return { success: false, reason: "paused" };

  // The platform instance's own token when configured; the global key otherwise.
  const apiKey = instanceKeyOf(process.env.PLATFORM_WA_INSTANCE_TOKEN, cfg.globalKey);
  const sent = await sendText(cfg, { instance, apiKey, number: recipient, text });
  if (!sent.ok) {
    // Log the status only; the body can echo the message text or the number.
    console.error("[platform-whatsapp] send failed:", sent.error, sent.status ?? "");
    return { success: false, reason: sent.error === "http" ? "provider_error" : "network_error" };
  }
  return { success: true };
}
