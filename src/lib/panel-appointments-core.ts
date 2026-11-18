// src/lib/panel-appointments-core.ts
// What happens when the owner or staff creates, edits or reopens a visit from /admin/citas (ticket #103).
// No I/O here: every database and calendar call comes in through PanelDeps, so the behavior is tested without
// either (tests/panel-appointments-core.test.ts). The HTTP adapter with the real calls is panel-appointments.ts.
// Rules (who is checked, which fields, what the calendar needs) live in appointment-admin-rules.ts.
import type { AppProvider, AppointmentStatus, BusinessVertical, ServiceModes } from "@prisma/client";
import {
  calendarEffectOf,
  isEditableStatus,
  parsePanelCreate,
  parsePanelEdit,
  reopenPlanFor,
  scheduleChecksFor,
  type CalendarFields,
} from "@/lib/appointment-admin-rules";
import { buildCalendarText } from "@/lib/appointment-calendar-text";
import { isBookable } from "@/lib/bookable";
import { parseBusinessHours, slotWithinHours, type BusinessHours } from "@/lib/business-hours";
import { clinicDateKeyOf, clinicTimeOf, DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/clinic-time";
import { effectiveModes, isSyntheticEmail, referralOf, resolveModality, type Modality } from "@/lib/patient-intake";
import { omitClinicalNotes } from "@/lib/permissions";
import { cleanPetName } from "@/lib/pets";
import { omitReminderError } from "@/lib/reminder-state";
import { getVerticalProfile } from "@/lib/vertical-profile";

const PANEL_FALLBACK_REASON = "Cita agendada desde el panel";
const DEFAULT_DURATION = 30;

// ── Shapes ───────────────────────────────────────────────────────────────────

/** What a handler answers; the adapter turns it into an HTTP response. */
export interface PanelResult {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

export interface PanelTenant {
  readonly id: string;
  readonly vertical: BusinessVertical;
  readonly isBookingEnabled: boolean;
  readonly businessHours: unknown;
  /** The business time zone (IANA, ticket #111); a bad value falls back to the default. */
  readonly timeZone: string;
  readonly serviceModes: ServiceModes;
  readonly hasPhysicalLocation: boolean;
  readonly address: string | null;
}

export interface PanelProduct {
  readonly id: string;
  readonly name: string;
  readonly durationMinutes: number | null;
  readonly requiresBooking: boolean;
  readonly visitModes: ServiceModes | null;
}

/** The fields of a visit these handlers read. Real rows carry more; they are passed through untouched. */
export interface VisitRow {
  readonly id: string;
  readonly status: AppointmentStatus | string;
  readonly appointmentDate: Date;
  readonly durationMinutes: number;
  readonly productId: string;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly customerEmail: string | null;
  readonly customerAge: number | null;
  readonly notes: string | null;
  readonly modality: Modality | null;
  readonly petId: string | null;
  readonly externalProvider: AppProvider | null;
  readonly externalEventId: string | null;
  readonly internalNotes?: string | null;
}

export interface FreeSlotRef {
  readonly date: string;
  readonly time: string;
  readonly iso: string;
}

export interface CreateVisitInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly productId: string;
  readonly appointmentDate: Date;
  readonly durationMinutes: number;
  readonly status: "PENDING" | "CONFIRMED";
  readonly customerConfirmedAt: Date | null;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly customerEmail: string | null;
  readonly customerAge: number;
  readonly modality: Modality;
  readonly notes: string | null;
  readonly petName: string | null;
  readonly petSpecies: string | null;
  readonly referredByKey: string | null;
  readonly referredByName: string | null;
  readonly checkConflicts: boolean;
  readonly calendar: { summary: string; description: string; attendeeEmail: string; location: string | null };
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

export interface EventDetails {
  readonly summary: string;
  readonly description: string;
  readonly start: Date;
  readonly end: Date;
  readonly attendeeEmail: string;
  readonly modality: Modality | null;
  readonly location: string | null;
}

type Write = { ok: true; appointment: VisitRow } | { ok: false; reason: "slot_unavailable" | "not_found" };

export interface PanelDeps {
  /** A product of this business, not deleted; `activeOnly` also requires it to be visible. */
  findProduct(tenantId: string, productId: string, options: { activeOnly: boolean }): Promise<PanelProduct | null>;
  /** The guest account of a phone (created once). A panel visit never links to an account by email (2026-11-14). */
  guestUserId(tenantId: string, phone: string, name: string): Promise<string>;
  knownPatientName(tenantId: string, phone: string): Promise<string | null>;
  createVisit(input: CreateVisitInput): Promise<{ ok: true; appointment: VisitRow } | { ok: false }>;
  updateVisit(tenantId: string, visit: VisitRow, changes: VisitChanges, checkConflicts: boolean): Promise<Write>;
  reopenVisit(tenantId: string, visit: VisitRow, toStatus: AppointmentStatus, now: Date): Promise<Write>;
  hasCalendar(tenantId: string): Promise<boolean>;
  /** Moves the event and/or changes its text; false when a connected calendar could not be updated. */
  updateEvent(tenantId: string, visit: VisitRow, range: { start: Date; end: Date }, text: { summary: string; description: string }): Promise<boolean>;
  /** Removes the event (if any) and creates a new one; null when either step failed. */
  replaceEvent(tenantId: string, visit: VisitRow, event: EventDetails): Promise<VisitRow | null>;
  reloadVisit(tenantId: string, id: string): Promise<VisitRow | null>;
  freeSlots(input: {
    tenantId: string;
    zone: string;
    hours: BusinessHours;
    durationMinutes: number;
    target: Date;
    now: Date;
    exclude?: { appointmentId: string; externalEventId: string | null };
  }): Promise<readonly FreeSlotRef[]>;
  petName(petId: string): Promise<string | null>;
  editTenant(tenantId: string): Promise<PanelTenant | null>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The stored zone when valid, the default otherwise (same rule as tenant-time-zone.ts, kept here free of server code). */
function usableTimeZone(zone: string | null | undefined): string {
  return isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

const fail = (status: number, error: string, extra: Record<string, unknown> = {}): PanelResult => ({
  status,
  body: { ...extra, error },
});

function endOf(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

function withinHours(hours: BusinessHours, start: Date, minutes: number, zone: string): boolean {
  return slotWithinHours(hours, clinicDateKeyOf(start, zone), clinicTimeOf(start, zone), minutes);
}

function attendeeOf(email: string | null): string {
  // No email (or the placeholder login of a patient who gave none) means no invitation.
  return email && !isSyntheticEmail(email) ? email : "";
}

function visitBody(role: string, visit: VisitRow, calendarSynced: boolean): Record<string, unknown> {
  return { ...omitClinicalNotes(role, omitReminderError(visit as VisitRow & { reminderLastError?: unknown })), calendarSynced };
}

/** A taken or out-of-hours time always comes back with the nearest free times (D10). */
async function slotRefused(
  deps: PanelDeps,
  code: "slot_unavailable" | "outside_business_hours",
  status: number,
  ctx: Parameters<PanelDeps["freeSlots"]>[0]
): Promise<PanelResult> {
  return fail(status, code, { alternatives: await deps.freeSlots(ctx) });
}

/** A connected calendar that holds no event for an active visit means the calendar step failed. */
async function calendarSyncedFor(deps: PanelDeps, tenantId: string, visit: VisitRow): Promise<boolean> {
  return Boolean(visit.externalEventId) || !(await deps.hasCalendar(tenantId));
}

function textFor(visit: VisitRow, serviceName: string, petName: string | null) {
  return buildCalendarText({
    serviceName,
    customerName: visit.customerName,
    petName,
    reason: visit.notes,
    fallbackReason: PANEL_FALLBACK_REASON,
    phone: visit.customerPhone,
    age: visit.customerAge,
    modality: visit.modality,
  });
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createCore(
  input: { role: string; tenant: PanelTenant; body: unknown; now: Date },
  deps: PanelDeps
): Promise<PanelResult> {
  const { role, tenant, now } = input;
  const parsed = parsePanelCreate(input.body, now);
  if (!parsed.ok) return fail(400, parsed.error);
  const d = parsed.data;

  const product = await deps.findProduct(tenant.id, d.productId, { activeOnly: true });
  if (!product) return fail(404, "product_not_found");
  if (!isBookable(product, tenant)) return fail(400, "not_bookable");

  const { usesPets } = getVerticalProfile(tenant.vertical, tenant.isBookingEnabled);
  const pet = usesPets ? cleanPetName(d.petName) : "";
  if (usesPets && !pet) return fail(400, "pet_required");

  const modality = resolveModality(tenant.serviceModes, d.modality, product.visitModes);
  if (!modality.ok) return fail(400, modality.error);

  const duration = product.durationMinutes || DEFAULT_DURATION;
  const hours = parseBusinessHours(tenant.businessHours);
  const checks = scheduleChecksFor(role, d.override);
  const zone = usableTimeZone(tenant.timeZone);
  const slot = { tenantId: tenant.id, zone, hours, durationMinutes: duration, target: d.appointmentDate, now };
  if (checks.hours && !withinHours(hours, d.appointmentDate, duration, zone)) return slotRefused(deps, "outside_business_hours", 400, slot);

  const userId = await deps.guestUserId(tenant.id, d.clientPhone, d.clientName);
  const referral = d.requesterPhone
    ? referralOf(true, d.requesterPhone, await deps.knownPatientName(tenant.id, d.requesterPhone))
    : { referredByKey: null, referredByName: null };
  const text = buildCalendarText({
    serviceName: product.name,
    customerName: d.clientName,
    petName: pet || null,
    reason: d.notes,
    fallbackReason: PANEL_FALLBACK_REASON,
    phone: d.clientPhone,
    age: d.clientAge,
    modality: modality.modality,
  });

  const result = await deps.createVisit({
    tenantId: tenant.id,
    userId,
    productId: product.id,
    appointmentDate: d.appointmentDate,
    durationMinutes: duration,
    // D1: confirmed on the call means no SI request in the reminder.
    status: d.alreadyConfirmed ? "CONFIRMED" : "PENDING",
    customerConfirmedAt: d.alreadyConfirmed ? now : null,
    customerName: d.clientName,
    customerPhone: d.clientPhone,
    customerEmail: d.clientEmail,
    customerAge: d.clientAge,
    modality: modality.modality,
    notes: d.notes,
    petName: pet || null,
    petSpecies: usesPets ? d.petSpecies : null,
    referredByKey: referral.referredByKey,
    referredByName: referral.referredByName,
    checkConflicts: checks.conflicts,
    calendar: { ...text, attendeeEmail: attendeeOf(d.clientEmail), location: tenant.hasPhysicalLocation ? tenant.address : null },
  });
  if (!result.ok) return slotRefused(deps, "slot_unavailable", 409, slot);

  const synced = await calendarSyncedFor(deps, tenant.id, result.appointment);
  return { status: 201, body: visitBody(role, result.appointment, synced) };
}

// ── Edit ─────────────────────────────────────────────────────────────────────

function calendarFieldsOf(v: VisitRow): CalendarFields {
  return {
    appointmentDate: v.appointmentDate,
    durationMinutes: v.durationMinutes,
    productId: v.productId,
    customerName: v.customerName,
    customerAge: v.customerAge,
    notes: v.notes,
    modality: v.modality,
    customerEmail: v.customerEmail,
  };
}

/** The visit's calendar event after an edit: new text, or a new event when the video link, address or guest change. */
async function syncEditedEvent(
  deps: PanelDeps,
  tenant: PanelTenant,
  before: VisitRow,
  after: VisitRow,
  extra: { productName: string; petName: string | null }
): Promise<{ visit: VisitRow; synced: boolean }> {
  const effect = calendarEffectOf(calendarFieldsOf(before), calendarFieldsOf(after));
  if (effect === "none") return { visit: after, synced: true };
  const text = textFor(after, extra.productName, extra.petName);
  const range = { start: after.appointmentDate, end: endOf(after.appointmentDate, after.durationMinutes) };
  if (effect === "update") return { visit: after, synced: await deps.updateEvent(tenant.id, after, range, text) };

  const replaced = await deps.replaceEvent(tenant.id, after, {
    ...text,
    ...range,
    attendeeEmail: attendeeOf(after.customerEmail),
    modality: after.modality,
    location: tenant.hasPhysicalLocation ? tenant.address : null,
  });
  if (replaced) return { visit: replaced, synced: await calendarSyncedFor(deps, tenant.id, replaced) };
  // Show what is really stored (the old event may be gone), and say the calendar was not updated.
  return { visit: (await deps.reloadVisit(tenant.id, after.id)) ?? after, synced: false };
}

/** The modality after a service or modality change: kept when the new service still offers it. */
function modalityAfterEdit(
  tenant: PanelTenant,
  product: PanelProduct,
  current: Modality | null,
  requestedChange: Modality | null | undefined
): { ok: true; modality: Modality | null } | { ok: false; error: string } {
  const allowed = effectiveModes(tenant.serviceModes, product.visitModes);
  const requested = requestedChange !== undefined ? requestedChange : current && allowed.includes(current) ? current : undefined;
  const resolved = resolveModality(tenant.serviceModes, requested, product.visitModes);
  return resolved.ok ? { ok: true, modality: resolved.modality } : { ok: false, error: resolved.error };
}

export async function editCore(
  input: { role: string; tenantId: string; appointment: VisitRow; body: unknown; now: Date },
  deps: PanelDeps
): Promise<PanelResult> {
  const { role, tenantId, appointment, now } = input;
  if (!isEditableStatus(appointment.status)) return fail(400, "appointment_not_editable");
  const parsed = parsePanelEdit(input.body, now);
  if (!parsed.ok) return fail(400, parsed.error);
  const d = parsed.data;

  const productChanged = d.productId !== undefined && d.productId !== appointment.productId;
  const [tenant, product, petName] = await Promise.all([
    deps.editTenant(tenantId),
    deps.findProduct(tenantId, productChanged ? (d.productId as string) : appointment.productId, { activeOnly: productChanged }),
    appointment.petId ? deps.petName(appointment.petId) : Promise.resolve(null),
  ]);
  if (!tenant) return fail(404, "tenant_not_found");
  if (!product) return fail(404, "product_not_found");
  if (productChanged && !isBookable(product, tenant)) return fail(400, "not_bookable");

  let modality = appointment.modality;
  if (productChanged || d.modality !== undefined) {
    const next = modalityAfterEdit(tenant, product, modality, d.modality);
    if (!next.ok) return fail(400, next.error);
    modality = next.modality;
  }

  const changes: VisitChanges = {
    ...(productChanged ? { productId: product.id, durationMinutes: product.durationMinutes || DEFAULT_DURATION } : {}),
    ...(d.appointmentDate ? { appointmentDate: d.appointmentDate } : {}),
    ...(d.clientName !== undefined ? { customerName: d.clientName } : {}),
    ...(d.clientAge !== undefined ? { customerAge: d.clientAge } : {}),
    ...(d.clientEmail !== undefined ? { customerEmail: d.clientEmail } : {}),
    ...(d.notes !== undefined ? { notes: d.notes } : {}),
    ...(modality !== appointment.modality ? { modality } : {}),
  };

  const start = changes.appointmentDate ?? appointment.appointmentDate;
  const duration = changes.durationMinutes ?? appointment.durationMinutes;
  const hours = parseBusinessHours(tenant.businessHours);
  const checks = scheduleChecksFor(role, d.override);
  const timeChanged = start.getTime() !== appointment.appointmentDate.getTime() || duration !== appointment.durationMinutes;
  const zone = usableTimeZone(tenant.timeZone);
  const slot = {
    tenantId,
    zone,
    hours,
    durationMinutes: duration,
    target: start,
    now,
    exclude: { appointmentId: appointment.id, externalEventId: appointment.externalEventId },
  };
  if (timeChanged && checks.hours && !withinHours(hours, start, duration, zone)) return slotRefused(deps, "outside_business_hours", 400, slot);

  const result = await deps.updateVisit(tenantId, appointment, changes, checks.conflicts);
  if (!result.ok) {
    return result.reason === "not_found" ? fail(404, "appointment_not_found") : slotRefused(deps, "slot_unavailable", 409, slot);
  }

  const { visit, synced } = await syncEditedEvent(deps, tenant, appointment, result.appointment, { productName: product.name, petName });
  return { status: 200, body: visitBody(role, visit, synced) };
}

// ── Reopen (owner decision of 2026-11-14) ────────────────────────────────────

export type ReopenOutcome =
  | { ok: true; appointment: VisitRow | null; calendarSynced: boolean }
  | { ok: false; result: PanelResult };

/**
 * A status change back to Pending or Confirmed (reopenPlanFor): a future visit needs its slot free, for every role,
 * and gets its calendar event back; a past cancelled one is refused; a past no-show or attended is a plain fix.
 * `appointment: null` means nothing was written here (the caller applies the status as usual).
 */
export async function reopenCore(
  input: { tenantId: string; appointment: VisitRow; toStatus: AppointmentStatus; now: Date },
  deps: PanelDeps
): Promise<ReopenOutcome> {
  const { tenantId, appointment, now } = input;
  const plan = reopenPlanFor(String(appointment.status), input.toStatus, appointment.appointmentDate, now);
  if (plan === "none" || plan === "allow") return { ok: true, appointment: null, calendarSynced: true };
  if (plan === "window_closed") return { ok: false, result: fail(400, "restore_window_closed") };

  const [tenant, product, petName] = await Promise.all([
    deps.editTenant(tenantId),
    deps.findProduct(tenantId, appointment.productId, { activeOnly: false }),
    appointment.petId ? deps.petName(appointment.petId) : Promise.resolve(null),
  ]);
  if (!tenant || !product) return { ok: false, result: fail(404, "appointment_not_found") };

  const reopened = await deps.reopenVisit(tenantId, appointment, input.toStatus, now);
  if (!reopened.ok) {
    if (reopened.reason === "not_found") return { ok: false, result: fail(404, "appointment_not_found") };
    const result = await slotRefused(deps, "slot_unavailable", 409, {
      tenantId,
      zone: usableTimeZone(tenant.timeZone),
      hours: parseBusinessHours(tenant.businessHours),
      durationMinutes: appointment.durationMinutes,
      target: appointment.appointmentDate,
      now,
      exclude: { appointmentId: appointment.id, externalEventId: appointment.externalEventId },
    });
    return { ok: false, result };
  }

  // The inactive visit lost its calendar event: put it back.
  const visit = reopened.appointment;
  const replaced = await deps.replaceEvent(tenantId, visit, {
    ...textFor(visit, product.name, petName),
    start: visit.appointmentDate,
    end: endOf(visit.appointmentDate, visit.durationMinutes),
    attendeeEmail: attendeeOf(visit.customerEmail),
    modality: visit.modality,
    location: tenant.hasPhysicalLocation ? tenant.address : null,
  });
  const current = replaced ?? (await deps.reloadVisit(tenantId, visit.id)) ?? visit;
  return { ok: true, appointment: current, calendarSynced: await calendarSyncedFor(deps, tenantId, current) };
}

