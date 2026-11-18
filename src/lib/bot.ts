// src/lib/bot.ts
// Shared helpers for the WhatsApp bot internal API (called by n8n).
// The tenant is always resolved server-side from the Evolution instance name,
// never from model output or request input the model can influence.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { locationTextForBot } from "@/lib/location";
import { tenantPublicUrl } from "@/lib/tenant-url";
import type { ServiceModes } from "@/lib/patient-intake";
import { getVerticalProfile } from "@/lib/vertical-profile";
import { BusinessHours, formatBusinessHours, parseBusinessHours, slotWithinHours, upcomingCalendarText } from "@/lib/business-hours";
import { clinicDateTime, clinicTimeLabel, isRealClinicTime } from "@/lib/clinic-time";
import { usableTimeZone } from "@/lib/tenant-time-zone";
import { timeZoneLabel } from "@/lib/time-zones";

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
  /** Slug and custom domain, to build the short links the customer receives (/ubicacion, /online/<code>). */
  shortLinkTenant: { slug: string; customDomain: string | null };
  /** Plain address for the calendar event of an in person visit; null without a physical location. */
  addressText: string | null;
  /** How the business sees patients: in person, online or both (see patient-intake.ts). */
  serviceModes: ServiceModes;
  usesPets: boolean;
  waContext: string | null;
  waTemperature: number;
  isBookingEnabled: boolean;
  businessHours: BusinessHours;
  businessHoursText: string;
  calendarText: string;
  /** The business time zone (IANA, ticket #111): every wall-clock time the bot reads or writes is in it. */
  timeZone: string;
  /** How the customer reads that zone in the business language: "hora de Cancún". */
  timeZoneLabel: string;
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
          serviceModes: true,
          timeZone: true,
        },
      },
    },
  });

  if (!app) return null;

  const businessHours = parseBusinessHours(app.tenant.businessHours);
  const timeZone = usableTimeZone(app.tenant.timeZone);
  return {
    tenantId: app.tenant.id,
    tenantName: app.tenant.name,
    messageLanguage: app.tenant.messageLanguage,
    privacyUrl: tenantPublicUrl(app.tenant, "/privacidad"),
    businessInfo: app.tenant.businessInfo,
    ownerName: app.tenant.ownerName,
    locationText: locationTextForBot(app.tenant),
    shortLinkTenant: { slug: app.tenant.slug, customDomain: app.tenant.customDomain },
    addressText: app.tenant.hasPhysicalLocation ? app.tenant.address : null,
    serviceModes: app.tenant.serviceModes,
    usesPets: getVerticalProfile(app.tenant.vertical, app.tenant.isBookingEnabled).usesPets,
    waContext: app.waContext,
    waTemperature: app.waTemperature ?? 0.7,
    isBookingEnabled: app.tenant.isBookingEnabled,
    businessHours,
    businessHoursText: formatBusinessHours(businessHours),
    calendarText: upcomingCalendarText(businessHours, timeZone),
    timeZone,
    timeZoneLabel: timeZoneLabel(timeZone, app.tenant.messageLanguage),
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
 * Builds start/end for a slot in the business's time zone. Returns null if the input is malformed, the time does not
 * exist that day (the hour skipped when daylight saving time starts) or the session does not fit the opening hours.
 */
export function buildSlot(date: string, time: string, durationMinutes: number, hours: BusinessHours, zone: string) {
  if (!DATE_REGEX.test(date) || !TIME_REGEX.test(time)) return null;
  if (!slotWithinHours(hours, date, time, durationMinutes)) return null;
  if (!isRealClinicTime(date, time, zone)) return null;

  const start = new Date(clinicDateTime(date, time, zone));
  if (isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60000);
  return { start, end };
}

/** "07:30 p.m." on the business clock. Kept as the bot's name for clinicTimeLabel, the single source of the format. */
export function formatSlotTime(date: Date, zone: string): string {
  return clinicTimeLabel(date, zone);
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
