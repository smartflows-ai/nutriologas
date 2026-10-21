// src/lib/appointments-service.ts
// One booking pipeline for the web agenda and the WhatsApp bot:
// conflict check under a per-day lock, then the DB row, then the mirror event on the connected calendar.
import { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { patientKeyOf } from "@/lib/patient-key";
import {
  CalendarLink,
  dateKeyInClinicZone,
  getExternalBusyPeriods,
  getNativeBusyPeriods,
  isSlotFree,
  syncCalendarCreate,
  syncCalendarDelete,
  syncCalendarUpdate,
} from "@/lib/calendar-sync";

export const appointmentInclude = {
  product: { select: { name: true, durationMinutes: true, price: true } },
  user: { select: { name: true, email: true } },
} as const;

export interface CalendarDetails {
  summary: string;
  description: string;
  attendeeEmail?: string;
}

export interface CreateAppointmentInput {
  tenantId: string;
  userId: string;
  productId: string;
  appointmentDate: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  calendar: CalendarDetails;
}

export type CreateAppointmentResult =
  | { ok: true; appointment: Awaited<ReturnType<typeof linkCreated>>; meetLink: string | null }
  | { ok: false; reason: "slot_unavailable" };

function endOf(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60000);
}

/**
 * Runs fn in a transaction that holds a lock on one tenant's clinic day. Two bookings for the same
 * day queue behind each other, so the conflict check and the write happen as one step.
 */
async function lockDay<T>(
  tenantId: string,
  date: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:${date}`}))`;
    return fn(tx);
  });
}

async function linkCreated(id: string, link: CalendarLink) {
  return prisma.appointment.update({
    where: { id },
    data: { externalProvider: link.externalProvider, externalEventId: link.externalEventId },
    include: appointmentInclude,
  });
}

export async function createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
  const end = endOf(input.appointmentDate, input.durationMinutes);
  const date = dateKeyInClinicZone(input.appointmentDate);
  // Calendar lookup is a network call, so it runs before the lock is taken.
  const external = await getExternalBusyPeriods(input.tenantId, date);

  const created = await lockDay(input.tenantId, date, async (tx) => {
    const native = await getNativeBusyPeriods(tx, input.tenantId, date);
    if (!isSlotFree([...native, ...external], input.appointmentDate, end)) return null;

    return tx.appointment.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        productId: input.productId,
        appointmentDate: input.appointmentDate,
        durationMinutes: input.durationMinutes,
        notes: input.notes,
        status: input.status,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        patientKey: patientKeyOf(input.customerPhone),
        customerEmail: input.customerEmail,
      },
      include: appointmentInclude,
    });
  });
  if (!created) return { ok: false, reason: "slot_unavailable" };

  const synced = await syncCalendarCreate(input.tenantId, {
    summary: input.calendar.summary,
    description: input.calendar.description,
    start: input.appointmentDate,
    end,
    attendeeEmail: input.calendar.attendeeEmail,
  });
  if (!synced) return { ok: true, appointment: created, meetLink: null };

  const appointment = await linkCreated(created.id, synced);
  return { ok: true, appointment, meetLink: synced.meetLink };
}

export interface RescheduleInput {
  tenantId: string;
  appointment: { id: string; durationMinutes: number } & CalendarLink;
  newStart: Date;
  /** Bot reschedules always check conflicts; admin edits may deliberately overbook. */
  checkConflicts: boolean;
}

export async function rescheduleAppointment(input: RescheduleInput) {
  const { appointment } = input;
  const end = endOf(input.newStart, appointment.durationMinutes);
  const date = dateKeyInClinicZone(input.newStart);
  const external = input.checkConflicts ? await getExternalBusyPeriods(input.tenantId, date) : [];

  const updated = await lockDay(input.tenantId, date, async (tx) => {
    if (input.checkConflicts) {
      const native = await getNativeBusyPeriods(tx, input.tenantId, date);
      const free = isSlotFree([...native, ...external], input.newStart, end, {
        appointmentId: appointment.id,
        externalEventId: appointment.externalEventId,
      });
      if (!free) return null;
    }

    return tx.appointment.update({
      where: { id: appointment.id },
      data: {
        appointmentDate: input.newStart,
        remindersSent: [], // a new time gets its own reminders
      },
      include: appointmentInclude,
    });
  });
  if (!updated) return { ok: false as const, reason: "slot_unavailable" as const };

  await syncCalendarUpdate(input.tenantId, appointment, { start: input.newStart, end });
  return { ok: true as const, appointment: updated };
}

/**
 * Cancels (or marks no-show) and removes the mirror event. The link is cleared only when the
 * event is really gone, so a failed delete stays visible for a retry.
 */
export async function cancelAppointment(
  tenantId: string,
  appointment: { id: string } & CalendarLink,
  status: "CANCELLED" | "NO_SHOW"
) {
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status },
    include: appointmentInclude,
  });

  if (appointment.externalEventId) {
    const removed = await syncCalendarDelete(tenantId, appointment);
    if (removed) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { externalProvider: null, externalEventId: null },
      });
    }
  }

  return updated;
}
