// src/lib/whatsapp.ts
// Centralized helper for WhatsApp messages through Evolution API.
// Ban prevention: every send goes through the messaging service (policy, idempotency, audit, breaker).
// The reasons returned here are the customer-safe ones (WA_NOT_AVAILABLE, WA_INVALID_NUMBER): a blocked or paused
// send never shows its internal cause to a customer. Tests: tests/messaging-service.test.ts.
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { WA_INVALID_NUMBER, WA_NOT_AVAILABLE } from "@/lib/whatsapp-reasons";
import { sendOutbound, type SendOutcome } from "@/lib/messaging/service";
import { prismaGateway, prismaOutboxStore } from "@/lib/messaging/gateway";
import type { ConsentState, MessagePurpose } from "@/lib/messaging/policy";

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
  /** Why the message is sent. Defaults to TRANSACTIONAL (a message about a visit). */
  purpose?: MessagePurpose;
  /** Consent for this recipient, decided by the caller. Defaults to NO (measured in SHADOW, blocked in ENFORCE). */
  consent?: ConsentState;
  urgent?: boolean;
  /** True when `to` is one of the business's own numbers. */
  recipientIsTeam?: boolean;
  /** Same key = same message: a retry of the same send is never delivered twice. Without it, every call is new. */
  idempotencyKey?: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  reason?: string;
  messageId?: string | null;
  data?: unknown;
}

function resultOf(outcome: SendOutcome): SendWhatsAppResult {
  if (outcome.status === "SENT") {
    return { success: true, messageId: outcome.providerMessageId, data: { duplicate: outcome.duplicate } };
  }
  // Customer-safe reason for every other outcome: the internal decision stays in the outbox, not on screen.
  return { success: false, reason: WA_NOT_AVAILABLE, data: { status: outcome.status } };
}

export async function sendWhatsAppMessage({
  tenantId,
  to,
  text,
  purpose = "TRANSACTIONAL",
  consent = "NO",
  urgent = false,
  recipientIsTeam = false,
  idempotencyKey,
}: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  try {
    const isJid = to.includes("@");
    if (isJid && !to.trim().endsWith("@s.whatsapp.net")) return { success: false, reason: WA_INVALID_NUMBER };
    const digits = isJid ? to.trim().replace(/@.*$/, "") : formatWhatsAppNumber(to);
    if (!digits || digits.length < 8) return { success: false, reason: WA_INVALID_NUMBER };

    const outcome = await sendOutbound(
      {
        tenantId,
        to: digits,
        purpose,
        text,
        idempotencyKey: idempotencyKey ?? `auto:${randomUUID()}`,
        consent,
        urgent,
        recipientIsTeam,
      },
      { store: prismaOutboxStore, gateway: prismaGateway, now: () => new Date() },
    );
    return resultOf(outcome);
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

  // A notice to the business's own number: internal purpose, no customer consent needed.
  const result = await sendWhatsAppMessage({
    tenantId,
    to: tenant.whatsappNumber,
    text: message,
    purpose: "INTERNAL",
    recipientIsTeam: true,
  });
  if (!result.success) {
    console.error(`[whatsapp] notifyTenantOwner failed for tenant ${tenantId}:`, result.reason);
  }
  return result.success;
}
