// src/lib/appointments-service.ts
// One booking pipeline for the web agenda and the WhatsApp bot:
// conflict check under a per-day lock, then the DB row, then the mirror event on the connected calendar.
import { AppointmentStatus, Prisma, type UserRole } from "@prisma/client";
import { restoreCheck } from "@/lib/appointment-admin-rules";
import { prisma } from "@/lib/db";
import { patientKeyOf } from "@/lib/patient-key";
import type { Modality } from "@/lib/patient-intake";
import type { ConsentSource } from "@/lib/wa-consent";
import { findOrCreatePet } from "@/lib/pets";
import { rescheduleResetState } from "@/lib/reminder-state";
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
import { newMeetShortCode } from "@/lib/short-links";
import { getTenantTimeZone } from "@/lib/tenant-time-zone";

export const appointmentInclude = {
  product: { select: { name: true, durationMinutes: true, price: true, priceMode: true } },
  user: { select: { name: true, email: true } },
} as const;

export interface CalendarDetails {
  summary: string;
  description: string;
  /** Without an email no invitation goes out; the event still lands on the doctor's calendar. */
  attendeeEmail?: string;
  /** Business address, used as the event location of an in person visit. */
  location?: string | null;
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
  /** Patient age, collected on the first booking and copied forward (see patient-intake.ts). */
  customerAge?: number | null;
  /** In person or online; null for callers that do not ask (older flows). */
  modality?: Modality | null;
  /** Set when the visit was booked for someone else: who recommended (see referralOf). */
  referredByKey?: string | null;
  referredByName?: string | null;
  notes: string | null;
  // Only for veterinary and pet-care tenants (see vertical-profile.ts); validated by the route.
  petName?: string | null;
  petSpecies?: string | null;
  calendar: CalendarDetails;
  /** False only for an owner who overbooks on purpose from the panel (ticket #103). Default: checked. */
  checkConflicts?: boolean;
  /** Set when the patient already confirmed (on the phone call): the reminder does not ask SI (ticket #103, D1). */
  customerConfirmedAt?: Date | null;
  /** Strict consent for proactive WhatsApp about this visit (feat/whatsapp-ban-prevention, src/lib/wa-consent.ts). */
  whatsappConsentAt?: Date | null;
  whatsappConsentSource?: ConsentSource | null;
  /** How the visit was booked: WHATSAPP | WEB | PANEL. */
  bookingChannel?: "WHATSAPP" | "WEB" | "PANEL" | null;
}

export type CreateAppointmentResult =
  | { ok: true; appointment: Awaited<ReturnType<typeof linkCreated>>; meetLink: string | null }
  | { ok: false; reason: "slot_unavailable" };

// Shared with appointments-panel-service.ts (ticket #103).
export function endOf(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60000);
}

/**
 * Runs fn in a transaction that holds a lock on one tenant's clinic day. Two bookings for the same
 * day queue behind each other, so the conflict check and the write happen as one step.
 */
export async function lockDay<T>(
  tenantId: string,
  date: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:${date}`}))`;
    return fn(tx);
  });
}

export async function linkCreated(id: string, link: CalendarLink, meetUrl: string | null) {
  const data = { externalProvider: link.externalProvider, externalEventId: link.externalEventId, meetUrl };
  // An online visit with a video call gets its own short code (the customer's link on the business subdomain).
  // A code that is already taken is rare (about 2e14 combinations); draw another one a few times, then fail loudly.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.appointment.update({
        where: { id },
        data: meetUrl ? { ...data, meetShortCode: newMeetShortCode() } : data,
        include: appointmentInclude,
      });
    } catch (error) {
      const taken = (error as { code?: string })?.code === "P2002";
      if (!meetUrl || !taken || attempt >= 2) throw error;
    }
  }
}

export async function createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
  const end = endOf(input.appointmentDate, input.durationMinutes);
  const zone = await getTenantTimeZone(input.tenantId);
  const date = dateKeyInClinicZone(input.appointmentDate, zone);
  const checkConflicts = input.checkConflicts ?? true;
  // Calendar lookup is a network call, so it runs before the lock is taken.
  const external = checkConflicts ? await getExternalBusyPeriods(input.tenantId, date, zone) : [];

  const created = await lockDay(input.tenantId, date, async (tx) => {
    if (checkConflicts) {
      const native = await getNativeBusyPeriods(tx, input.tenantId, date, zone);
      if (!isSlotFree([...native, ...external], input.appointmentDate, end)) return null;
    }

    const patientKey = patientKeyOf(input.customerPhone);
    const petId = await findOrCreatePet(tx, {
      tenantId: input.tenantId,
      patientKey,
      name: input.petName ?? "",
      species: input.petSpecies,
    });

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
        patientKey,
        petId,
        customerEmail: input.customerEmail,
        customerAge: input.customerAge ?? null,
        modality: input.modality ?? null,
        referredByKey: input.referredByKey ?? null,
        referredByName: input.referredByName ?? null,
        customerConfirmedAt: input.customerConfirmedAt ?? null,
        whatsappConsentAt: input.whatsappConsentAt ?? null,
        whatsappConsentSource: input.whatsappConsentSource ?? null,
        bookingChannel: input.bookingChannel ?? null,
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
    modality: input.modality ?? null,
    location: input.calendar.location ?? null,
  });
  if (!synced) return { ok: true, appointment: created, meetLink: null };

  // Only an online visit keeps a video link; an in person event has none.
  const meetLink = input.modality === "IN_PERSON" ? null : synced.meetLink;
  const appointment = await linkCreated(created.id, synced, meetLink);
  return { ok: true, appointment, meetLink };
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
  const zone = await getTenantTimeZone(input.tenantId);
  const date = dateKeyInClinicZone(input.newStart, zone);
  const external = input.checkConflicts ? await getExternalBusyPeriods(input.tenantId, date, zone) : [];

  const updated = await lockDay(input.tenantId, date, async (tx) => {
    if (input.checkConflicts) {
      const native = await getNativeBusyPeriods(tx, input.tenantId, date, zone);
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
        ...rescheduleResetState(), // a new time gets its own reminder, confirmation and failure history
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

// ── Soft delete and restore (ticket #103) ────────────────────────────────────

/** Who deleted or restored a visit; written to appointment_trail. */
export interface TrailActor {
  readonly userId: string;
  readonly role: UserRole;
}

export type SoftDeleteResult = { ok: true } | { ok: false; reason: "calendar_sync_failed" | "not_found" };

/**
 * Hides a visit: the mirror event goes first, so a visit whose event cannot be removed stays visible for a retry.
 * The row is kept (deletedAt, deletedById) and one DELETED row is written to the trail, in one transaction.
 */
export async function softDeleteAppointment(
  tenantId: string,
  appointment: { id: string; appointmentDate: Date } & CalendarLink,
  actor: TrailActor
): Promise<SoftDeleteResult> {
  const removed = await syncCalendarDelete(tenantId, appointment);
  if (!removed) return { ok: false, reason: "calendar_sync_failed" };

  const at = new Date();
  // Same per-day lock as bookings and edits, so a delete and an edit of one visit never interleave.
  const zone = await getTenantTimeZone(tenantId);
  const hidden = await lockDay(tenantId, dateKeyInClinicZone(appointment.appointmentDate, zone), async (tx) => {
    // Only a visit that is not deleted yet: two clicks at once write one trail row.
    const result = await tx.appointment.updateMany({
      where: { id: appointment.id, tenantId, deletedAt: null },
      data: { deletedAt: at, deletedById: actor.userId, externalProvider: null, externalEventId: null },
    });
    if (result.count === 0) return false;
    await tx.appointmentTrail.create({
      data: { tenantId, appointmentId: appointment.id, action: "DELETED", userId: actor.userId, role: actor.role, at },
    });
    return true;
  });
  return hidden ? { ok: true } : { ok: false, reason: "not_found" };
}

/** What a restore needs to rebuild the calendar event. */
export interface RestorableVisit {
  readonly id: string;
  readonly status: AppointmentStatus;
  readonly appointmentDate: Date;
  readonly durationMinutes: number;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly customerEmail: string | null;
  readonly customerAge: number | null;
  readonly modality: Modality | null;
  readonly notes: string | null;
  readonly product: { readonly name: string };
  readonly pet: { readonly name: string } | null;
}

export interface RestoreInput {
  readonly tenantId: string;
  readonly appointmentId: string;
  readonly actor: TrailActor;
  readonly now: Date;
  /** One of the free times offered when the original slot is taken; null keeps the original time. */
  readonly newStart: Date | null;
  /** Business hours check for a new time (the original time is kept as it was booked). */
  readonly withinHours: (start: Date, durationMinutes: number) => boolean;
  readonly calendarFor: (visit: RestorableVisit) => CalendarDetails;
}

export type RestoreResult =
  | { ok: true; appointment: Awaited<ReturnType<typeof linkCreated>> }
  | { ok: false; reason: "not_found" | "restore_window_closed" | "slot_unavailable" | "outside_business_hours" | "date_in_past" };

const ACTIVE_STATUSES: readonly AppointmentStatus[] = ["PENDING", "CONFIRMED"];

async function unhide(
  tx: Prisma.TransactionClient,
  input: RestoreInput,
  data: Prisma.AppointmentUpdateManyMutationInput
): Promise<boolean> {
  const result = await tx.appointment.updateMany({
    where: { id: input.appointmentId, tenantId: input.tenantId, deletedAt: { not: null } },
    data: { ...data, deletedAt: null, deletedById: null },
  });
  if (result.count === 0) return false;
  await tx.appointmentTrail.create({
    data: {
      tenantId: input.tenantId,
      appointmentId: input.appointmentId,
      action: "RESTORED",
      userId: input.actor.userId,
      role: input.actor.role,
      at: input.now,
    },
  });
  return true;
}

/**
 * Brings a deleted visit back (D14 to D16): only before its original start time, and an active visit only into a
 * free slot, for every role (nobody restores on top of another visit). A new free time may be chosen instead.
 * An active visit gets a new calendar event and a fresh reminder; a cancelled or past-status one just reappears.
 */
export async function restoreAppointment(input: RestoreInput): Promise<RestoreResult> {
  const visit = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, tenantId: input.tenantId, deletedAt: { not: null } },
    select: {
      id: true,
      status: true,
      appointmentDate: true,
      durationMinutes: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      customerAge: true,
      modality: true,
      notes: true,
      product: { select: { name: true } },
      pet: { select: { name: true } },
    },
  });
  if (!visit) return { ok: false, reason: "not_found" };
  if (!restoreCheck(visit, input.now).ok) return { ok: false, reason: "restore_window_closed" };

  if (!ACTIVE_STATUSES.includes(visit.status)) {
    const done = await prisma.$transaction((tx) => unhide(tx, input, {}));
    if (!done) return { ok: false, reason: "not_found" };
    return { ok: true, appointment: await reloadVisit(input.appointmentId) };
  }

  const start = input.newStart ?? visit.appointmentDate;
  if (input.newStart) {
    if (input.newStart.getTime() <= input.now.getTime()) return { ok: false, reason: "date_in_past" };
    if (!input.withinHours(input.newStart, visit.durationMinutes)) return { ok: false, reason: "outside_business_hours" };
  }
  const end = endOf(start, visit.durationMinutes);
  const zone = await getTenantTimeZone(input.tenantId);
  const date = dateKeyInClinicZone(start, zone);
  const external = await getExternalBusyPeriods(input.tenantId, date, zone);

  const restored = await lockDay(input.tenantId, date, async (tx) => {
    const native = await getNativeBusyPeriods(tx, input.tenantId, date, zone);
    if (!isSlotFree([...native, ...external], start, end)) return "slot_unavailable" as const;
    const done = await unhide(tx, input, { appointmentDate: start, ...rescheduleResetState() });
    return done ? ("restored" as const) : ("not_found" as const);
  });
  if (restored !== "restored") return { ok: false, reason: restored };

  const calendar = input.calendarFor({ ...visit, appointmentDate: start });
  const synced = await syncCalendarCreate(input.tenantId, {
    summary: calendar.summary,
    description: calendar.description,
    start,
    end,
    attendeeEmail: calendar.attendeeEmail,
    modality: visit.modality,
    location: calendar.location ?? null,
  });
  if (!synced) return { ok: true, appointment: await reloadVisit(input.appointmentId) };
  const meetLink = visit.modality === "IN_PERSON" ? null : synced.meetLink;
  return { ok: true, appointment: await linkCreated(input.appointmentId, synced, meetLink) };
}

async function reloadVisit(id: string) {
  // Reads back the visit just restored (it is no longer deleted).
  return prisma.appointment.findUniqueOrThrow({ where: { id, deletedAt: null }, include: appointmentInclude });
}
