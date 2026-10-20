// src/lib/calendar-sync.ts
// Keeps the tenant's connected calendar (Google or Outlook) in step with native appointments.
// The DB row is the source of truth. The sync helpers are best-effort: a calendar failure is
// logged and never fails a booking.
import { AppProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAppToken, getConnectedProvider } from "@/lib/connected-apps";
import { createCalendarEvent, deleteCalendarEvent, fetchCalendarEvents, updateCalendarEvent } from "@/lib/google-calendar";
import {
  createMicrosoftEvent,
  deleteMicrosoftEvent,
  fetchMicrosoftEvents,
  parseGraphDateTime,
  updateMicrosoftEvent,
} from "@/lib/microsoft-calendar";
import { ACTIVE_APPOINTMENT_STATUSES, BOT_TIMEZONE_OFFSET } from "@/lib/bot";

export const CALENDAR_PROVIDERS: AppProvider[] = ["GOOGLE", "MICROSOFT"];

export interface CalendarLink {
  externalProvider: AppProvider | null;
  externalEventId: string | null;
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail?: string;
}

export interface BusyPeriod {
  start: number;
  end: number;
  appointmentId?: string;
  externalEventId?: string;
}

/** Key that identifies one calendar event across providers. */
export function linkKey(provider: AppProvider, eventId: string): string {
  return `${provider}:${eventId}`;
}

/** Keys of every external event that a native appointment already mirrors. */
export function linkedEventKeys(rows: CalendarLink[]): Set<string> {
  return new Set(
    rows.flatMap((r) =>
      r.externalProvider && r.externalEventId ? [linkKey(r.externalProvider, r.externalEventId)] : []
    )
  );
}

/** Calendar date (YYYY-MM-DD) of an instant in the clinic's timezone. */
export function dateKeyInClinicZone(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/** Active native appointments for one clinic day. Pass a transaction client to read under a lock. */
export async function getNativeBusyPeriods(
  db: Pick<Prisma.TransactionClient, "appointment">,
  tenantId: string,
  date: string
): Promise<BusyPeriod[]> {
  const dayStart = new Date(`${date}T00:00:00${BOT_TIMEZONE_OFFSET}`);
  const dayEnd = new Date(`${date}T23:59:59${BOT_TIMEZONE_OFFSET}`);

  const appointments = await db.appointment.findMany({
    where: {
      tenantId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      appointmentDate: { gte: dayStart, lte: dayEnd },
    },
    select: { id: true, externalEventId: true, appointmentDate: true, durationMinutes: true },
  });

  return appointments.map((a) => {
    const start = a.appointmentDate.getTime();
    return {
      start,
      end: start + a.durationMinutes * 60000,
      appointmentId: a.id,
      externalEventId: a.externalEventId ?? undefined,
    };
  });
}

/** Events on the tenant's connected calendar for one clinic day. Failures return no events. */
export async function getExternalBusyPeriods(tenantId: string, date: string): Promise<BusyPeriod[]> {
  const dayStart = new Date(`${date}T00:00:00${BOT_TIMEZONE_OFFSET}`);
  const dayEnd = new Date(`${date}T23:59:59${BOT_TIMEZONE_OFFSET}`);
  return fetchExternalBusy(tenantId, dayStart, dayEnd, date);
}

/**
 * Busy periods for one day: active native appointments plus events on the tenant's connected
 * calendar. Calendar failures fall back to the DB only.
 */
export async function getBusyPeriods(tenantId: string, date: string): Promise<BusyPeriod[]> {
  const [native, external] = await Promise.all([
    getNativeBusyPeriods(prisma, tenantId, date),
    getExternalBusyPeriods(tenantId, date),
  ]);
  return [...native, ...external];
}

async function fetchExternalBusy(tenantId: string, dayStart: Date, dayEnd: Date, date: string): Promise<BusyPeriod[]> {
  try {
    const provider = await getConnectedProvider(tenantId, CALENDAR_PROVIDERS);
    if (!provider) return [];
    const token = await getAppToken(tenantId, provider);
    if (!token) return [];

    if (provider === "GOOGLE") {
      const events = await fetchCalendarEvents(token, dayStart.toISOString(), dayEnd.toISOString());
      return events.flatMap((e: any): BusyPeriod[] => {
        if (!e.start || e.transparency === "transparent" || e.status === "cancelled") return [];
        const start = e.start.dateTime
          ? new Date(e.start.dateTime).getTime()
          : new Date(`${e.start.date}T00:00:00${BOT_TIMEZONE_OFFSET}`).getTime();
        const end = e.end?.dateTime
          ? new Date(e.end.dateTime).getTime()
          : new Date(`${e.end?.date ?? e.start.date}T00:00:00${BOT_TIMEZONE_OFFSET}`).getTime();
        return [{ start, end, externalEventId: e.id }];
      });
    }

    const events = await fetchMicrosoftEvents(token, dayStart.toISOString(), dayEnd.toISOString());
    return events.flatMap((e: any): BusyPeriod[] => {
      if (!e.start?.dateTime || e.isCancelled || e.showAs === "free") return [];
      const start = parseGraphDateTime(e.start.dateTime).getTime();
      const end = e.end?.dateTime ? parseGraphDateTime(e.end.dateTime).getTime() : start;
      return [{ start, end, externalEventId: e.id }];
    });
  } catch (err) {
    console.error(`[calendar-sync] Busy lookup failed for ${date}:`, err);
    return [];
  }
}

/**
 * True when [start, end) overlaps no busy period, ignoring the appointment being edited
 * (its own row and its own mirrored event).
 */
export function isSlotFree(
  periods: BusyPeriod[],
  start: Date,
  end: Date,
  self?: { appointmentId?: string; externalEventId?: string | null }
): boolean {
  return !periods.some((p) => {
    if (self?.appointmentId && p.appointmentId === self.appointmentId) return false;
    if (self?.externalEventId && p.externalEventId === self.externalEventId) return false;
    return start.getTime() < p.end && end.getTime() > p.start;
  });
}

/**
 * Creates the mirror event on the connected calendar. Returns the link to store, or null when
 * no calendar is connected or the provider call failed.
 */
export async function syncCalendarCreate(
  tenantId: string,
  input: CalendarEventInput
): Promise<(CalendarLink & { meetLink: string | null }) | null> {
  try {
    const provider = await getConnectedProvider(tenantId, CALENDAR_PROVIDERS);
    if (!provider) return null;
    const token = await getAppToken(tenantId, provider);
    if (!token) return null;

    if (provider === "GOOGLE") {
      const event = await createCalendarEvent(token, {
        summary: input.summary,
        description: input.description,
        startDateTime: input.start.toISOString(),
        endDateTime: input.end.toISOString(),
        attendeeEmail: input.attendeeEmail ?? "",
      });
      return { externalProvider: "GOOGLE", externalEventId: event.id, meetLink: event.hangoutLink ?? null };
    }

    const event = await createMicrosoftEvent(token, {
      subject: input.summary,
      body: input.description,
      start: input.start,
      end: input.end,
      attendeeEmail: input.attendeeEmail,
    });
    return { externalProvider: "MICROSOFT", externalEventId: event.id, meetLink: null };
  } catch (err) {
    console.error("[calendar-sync] Could not create calendar event:", err);
    return null;
  }
}

/**
 * Moves the mirror event of a linked appointment. Uses the provider the row was linked with,
 * even if the tenant has since connected a different calendar.
 */
export async function syncCalendarUpdate(
  tenantId: string,
  link: CalendarLink,
  range: { start: Date; end: Date }
): Promise<void> {
  if (!link.externalProvider || !link.externalEventId) return;
  try {
    const token = await getAppToken(tenantId, link.externalProvider);
    if (!token) return;

    if (link.externalProvider === "GOOGLE") {
      await updateCalendarEvent(token, link.externalEventId, {
        startDateTime: range.start.toISOString(),
        endDateTime: range.end.toISOString(),
      });
    } else {
      await updateMicrosoftEvent(token, link.externalEventId, range);
    }
  } catch (err) {
    console.error("[calendar-sync] Could not update calendar event:", err);
  }
}

/**
 * Removes the mirror event of a linked appointment. Returns false only when the provider call
 * failed, so the caller can keep the link for a retry.
 */
export async function syncCalendarDelete(tenantId: string, link: CalendarLink): Promise<boolean> {
  if (!link.externalProvider || !link.externalEventId) return true;
  try {
    const token = await getAppToken(tenantId, link.externalProvider);
    if (!token) return true;

    if (link.externalProvider === "GOOGLE") {
      await deleteCalendarEvent(token, link.externalEventId);
    } else {
      await deleteMicrosoftEvent(token, link.externalEventId);
    }
    return true;
  } catch (err) {
    console.error("[calendar-sync] Could not delete calendar event:", err);
    return false;
  }
}
