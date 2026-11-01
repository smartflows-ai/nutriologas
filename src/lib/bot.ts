// src/lib/bot.ts
// Shared helpers for the WhatsApp bot internal API (called by n8n).
// The tenant is always resolved server-side from the Evolution instance name,
// never from model output or request input the model can influence.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { locationTextForBot } from "@/lib/location";
import { tenantPublicUrl } from "@/lib/tenant-url";
import { getVerticalProfile } from "@/lib/vertical-profile";
import { BusinessHours, formatBusinessHours, parseBusinessHours, slotWithinHours, upcomingCalendarText } from "@/lib/business-hours";

export const BOT_TIMEZONE_OFFSET = "-06:00"; // America/Mexico_City (CST)

export const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED"] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export interface BotTenant {
  tenantId: string;
  tenantName: string;
  messageLanguage: string;
  privacyUrl: string;
  businessInfo: string | null;
  ownerName: string | null;
  locationText: string;
  usesPets: boolean;
  waContext: string | null;
  waTemperature: number;
  isBookingEnabled: boolean;
  businessHours: BusinessHours;
  businessHoursText: string;
  calendarText: string;
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
      tenant: {
        select: {
          id: true,
          name: true,
          messageLanguage: true,
          slug: true,
          customDomain: true,
          businessInfo: true,
          vertical: true,
          ownerName: true,
          hasPhysicalLocation: true,
          address: true,
          placeId: true,
          latitude: true,
          longitude: true,
          isBookingEnabled: true,
          businessHours: true,
        },
      },
    },
  });

  if (!app) return null;

  const businessHours = parseBusinessHours(app.tenant.businessHours);
  return {
    tenantId: app.tenant.id,
    tenantName: app.tenant.name,
    messageLanguage: app.tenant.messageLanguage,
    privacyUrl: tenantPublicUrl(app.tenant, "/privacidad"),
    businessInfo: app.tenant.businessInfo,
    ownerName: app.tenant.ownerName,
    locationText: locationTextForBot(app.tenant),
    usesPets: getVerticalProfile(app.tenant.vertical, app.tenant.isBookingEnabled).usesPets,
    waContext: app.waContext,
    waTemperature: app.waTemperature ?? 0.7,
    isBookingEnabled: app.tenant.isBookingEnabled,
    businessHours,
    businessHoursText: formatBusinessHours(businessHours),
    calendarText: upcomingCalendarText(businessHours),
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
 * or the session does not fit the business's opening hours for that day.
 */
export function buildSlot(date: string, time: string, durationMinutes: number, hours: BusinessHours) {
  if (!DATE_REGEX.test(date) || !TIME_REGEX.test(time)) return null;
  if (!slotWithinHours(hours, date, time, durationMinutes)) return null;

  const start = new Date(`${date}T${time}:00${BOT_TIMEZONE_OFFSET}`);
  if (isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60000);
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
