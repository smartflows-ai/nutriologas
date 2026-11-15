// src/lib/appointments-panel-service.ts
// Database and calendar steps for visits edited or reopened from /admin/citas (ticket #103).
// The rules (who is checked, which fields, what the calendar needs) live in appointment-admin-rules.ts; the HTTP
// handlers in panel-appointments.ts. Same per-day lock as every booking, so two writers never take one slot.
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appointmentInclude, endOf, linkCreated, lockDay } from "@/lib/appointments-service";
import {
  type BusyPeriod,
  dateKeyInClinicZone,
  getExternalBusyPeriods,
  getNativeBusyPeriods,
  isSlotFree,
  syncCalendarCreate,
  syncCalendarDelete,
  type CalendarLink,
} from "@/lib/calendar-sync";
import type { Modality } from "@/lib/patient-intake";
import { rescheduleResetState } from "@/lib/reminder-state";

export interface VisitRef extends CalendarLink {
  readonly id: string;
  readonly appointmentDate: Date;
  readonly durationMinutes: number;
}

export interface VisitChanges {
  readonly productId?: string;
  readonly durationMinutes?: number;
  readonly appointmentDate?: Date;
  readonly customerName?: string;
  readonly customerAge?: number;
  readonly customerEmail?: string | null;
  readonly modality?: Modality | null;
  readonly notes?: string | null;
}

export type SlotWrite<T> = { ok: true; appointment: T } | { ok: false; reason: "slot_unavailable" | "not_found" };

/** A visit as the panel handlers return it (with its product and user). */
export type PanelVisit = Awaited<ReturnType<typeof linkCreated>>;

async function slotIsFree(
  tenantId: string,
  visit: VisitRef,
  start: Date,
  durationMinutes: number,
  tx: Prisma.TransactionClient,
  external: BusyPeriod[]
): Promise<boolean> {
  const date = dateKeyInClinicZone(start);
  const native = await getNativeBusyPeriods(tx, tenantId, date);
  return isSlotFree([...native, ...external], start, endOf(start, durationMinutes), {
    appointmentId: visit.id,
    externalEventId: visit.externalEventId,
  });
}

/** The row just written, or not_found when the write touched nothing (the visit was deleted in between). */
async function readBack(tx: Prisma.TransactionClient, tenantId: string, id: string, count: number): Promise<SlotWrite<PanelVisit>> {
  if (count === 0) return { ok: false, reason: "not_found" };
  const row = await tx.appointment.findFirst({ where: { id, tenantId, deletedAt: null }, include: appointmentInclude });
  return row ? { ok: true, appointment: row } : { ok: false, reason: "not_found" };
}

/**
 * Applies an edit. A new time or duration is checked against the other visits and the calendar when
 * `checkConflicts` is on (staff always; the owner unless overbooking on purpose), and restarts the reminder.
 */
export async function updateVisit(
  tenantId: string,
  visit: VisitRef,
  changes: VisitChanges,
  checkConflicts: boolean
): Promise<SlotWrite<PanelVisit>> {
  const start = changes.appointmentDate ?? visit.appointmentDate;
  const duration = changes.durationMinutes ?? visit.durationMinutes;
  const timeChanged = start.getTime() !== visit.appointmentDate.getTime() || duration !== visit.durationMinutes;
  const check = checkConflicts && timeChanged;
  const date = dateKeyInClinicZone(start);
  const external = check ? await getExternalBusyPeriods(tenantId, date) : [];

  return lockDay(tenantId, date, async (tx) => {
    if (check && !(await slotIsFree(tenantId, visit, start, duration, tx, external))) {
      return { ok: false as const, reason: "slot_unavailable" as const };
    }
    // Only a visit that is still not deleted: a delete in between wins and the edit answers 404 (security review S2).
    const written = await tx.appointment.updateMany({
      where: { id: visit.id, tenantId, deletedAt: null },
      data: { ...changes, ...(timeChanged ? rescheduleResetState() : {}) },
    });
    return readBack(tx, tenantId, visit.id, written.count);
  });
}

/**
 * Reopens a cancelled visit with the restore rules (D17): its slot must be free, for every role. The visit gets a
 * fresh reminder; reopening as CONFIRMED counts as the owner's confirmation, like the Confirmar button.
 */
export async function reopenVisit(
  tenantId: string,
  visit: VisitRef,
  toStatus: AppointmentStatus,
  now: Date
): Promise<SlotWrite<PanelVisit>> {
  const date = dateKeyInClinicZone(visit.appointmentDate);
  const external = await getExternalBusyPeriods(tenantId, date);
  return lockDay(tenantId, date, async (tx) => {
    if (!(await slotIsFree(tenantId, visit, visit.appointmentDate, visit.durationMinutes, tx, external))) {
      return { ok: false as const, reason: "slot_unavailable" as const };
    }
    const written = await tx.appointment.updateMany({
      where: { id: visit.id, tenantId, deletedAt: null },
      data: {
        ...rescheduleResetState(),
        status: toStatus,
        customerConfirmedAt: toStatus === "CONFIRMED" ? now : null,
      },
    });
    return readBack(tx, tenantId, visit.id, written.count);
  });
}

export interface EventDetails {
  readonly summary: string;
  readonly description: string;
  readonly start: Date;
  readonly end: Date;
  /** Empty: no invitation goes out. */
  readonly attendeeEmail: string;
  readonly modality: Modality | null;
  readonly location: string | null;
}

/**
 * Puts a new event on the connected calendar for a visit (the old one, if any, is removed first). Used when the
 * modality or the email changes (new video link, address or guest) and when a cancelled visit is reopened.
 * If the old event cannot be removed, nothing changes, so no duplicate event is left on the calendar.
 */
export async function replaceCalendarEvent(tenantId: string, visit: { id: string } & CalendarLink, event: EventDetails) {
  const removed = await syncCalendarDelete(tenantId, visit);
  if (!removed) return null;
  const cleared = await prisma.appointment.updateMany({
    where: { id: visit.id, tenantId, deletedAt: null },
    data: { externalProvider: null, externalEventId: null, meetUrl: null, meetShortCode: null },
  });
  // Deleted in between: no new event for a hidden visit.
  if (cleared.count === 0) return null;
  const synced = await syncCalendarCreate(tenantId, event);
  if (!synced) return null;
  // Only an online visit keeps a video link; an in person event has none.
  const meetLink = event.modality === "IN_PERSON" ? null : synced.meetLink;
  return linkCreated(visit.id, synced, meetLink);
}
