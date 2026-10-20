// src/lib/bot.ts
// Shared helpers for the WhatsApp bot internal API (called by n8n).
// The tenant is always resolved server-side from the Evolution instance name,
// never from model output or request input the model can influence.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const BOT_TIMEZONE_OFFSET = "-06:00"; // America/Mexico_City (CST)
export const BOT_DAY_START = "08:00";
export const BOT_DAY_END = "20:00";

export const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED"] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export interface BotTenant {
  tenantId: string;
  tenantName: string;
  businessInfo: string | null;
  waContext: string | null;
  waTemperature: number;
}

export function isInternalKeyValid(req: NextRequest): boolean {
  return req.headers.get("x-internal-key") === process.env.INTERNAL_API_KEY;
}

export async function resolveBotTenant(instance: unknown): Promise<BotTenant | null> {
  if (typeof instance !== "string" || !instance) return null;

  const app = await prisma.connectedApp.findFirst({
    where: {
      provider: "WHATSAPP",
      OR: [{ waInstanceName: instance }, { waInstanceId: instance }],
    },
    select: {
      waContext: true,
      waTemperature: true,
      tenant: { select: { id: true, name: true, businessInfo: true } },
    },
  });

  if (!app) return null;

  return {
    tenantId: app.tenant.id,
    tenantName: app.tenant.name,
    businessInfo: app.tenant.businessInfo,
    waContext: app.waContext,
    waTemperature: app.waTemperature ?? 0.7,
  };
}

/**
 * Returns the customer's real phone (digits only, country code included).
 * Prefers remoteJidAlt: in LID addressing mode remoteJid can be an opaque @lid id.
 */
export function normalizeCustomerPhone(remoteJid?: string | null, remoteJidAlt?: string | null): string | null {
  for (const jid of [remoteJidAlt, remoteJid]) {
    if (jid && jid.endsWith("@s.whatsapp.net")) {
      const digits = jid.split("@")[0].replace(/\D/g, "");
      if (digits.length >= 8) return digits;
    }
  }
  return null;
}

/**
 * Builds start/end for a slot in Mexico City time. Returns null if the input is malformed
 * or the slot falls outside business hours.
 */
export function buildSlot(date: string, time: string, durationMinutes: number) {
  if (!DATE_REGEX.test(date) || !TIME_REGEX.test(time)) return null;

  const start = new Date(`${date}T${time}:00${BOT_TIMEZONE_OFFSET}`);
  if (isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60000);
  const dayStart = new Date(`${date}T${BOT_DAY_START}:00${BOT_TIMEZONE_OFFSET}`).getTime();
  const dayEnd = new Date(`${date}T${BOT_DAY_END}:00${BOT_TIMEZONE_OFFSET}`).getTime();

  if (start.getTime() < dayStart || end.getTime() > dayEnd) return null;
  return { start, end };
}

export function formatSlotTime(date: Date): string {
  return date.toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * All chat JIDs that can belong to one contact: its phone JID, the raw JID and the alt JID.
 */
export function contactJids(digits: string | null, remoteJid: unknown, remoteJidAlt: unknown): string[] {
  const candidates = [digits ? `${digits}@s.whatsapp.net` : null, remoteJid, remoteJidAlt];
  return Array.from(
    new Set(candidates.filter((jid): jid is string => typeof jid === "string" && jid.includes("@")))
  );
}
