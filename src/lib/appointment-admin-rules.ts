// src/lib/appointment-admin-rules.ts
// Rules for creating, editing, deleting and restoring visits from /admin/citas (ticket #103).
// Pure functions, no I/O: the routes load the data, call these and write the result.
import { z } from "zod";
import { can } from "@/lib/permissions";
import { patientKeyOf } from "@/lib/patient-key";
import { parseAge, type Modality } from "@/lib/patient-intake";
import { isPlausibleFullName } from "@/lib/full-name";

type Role = string | null | undefined;

/** Error codes these rules return; each one has a translation in t.apiErrors. */
export type PanelRuleError =
  | "service_and_date_required"
  | "date_invalid"
  | "date_in_past"
  | "date_too_far"
  | "name_required"
  | "full_name_required"
  | "phone_required"
  | "age_required"
  | "email_invalid"
  | "validation_failed"
  | "requester_phone_required"
  | "other_person_same_phone"
  | "field_not_allowed"
  | "field_not_editable";

export type RuleResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: PanelRuleError };

const MAX_NAME = 120;
const MAX_NOTES = 2000;
const MAX_PET_NAME = 60;
const MAX_EMAIL = 254; // RFC 5321 limit
const MAX_ID = 64;
const MAX_PHONE = 32;
// A booking further ahead than this is almost surely a typo, and each far day costs calendar lookups.
const MAX_DAYS_AHEAD = 366;
const DAY_MS = 86_400_000;
const ACTIVE_STATUSES: readonly string[] = ["PENDING", "CONFIRMED"];
const EDITABLE_STATUSES = ACTIVE_STATUSES;
// The phone is the patient's identity (history, reminders): never changed on an existing visit.
const NON_EDITABLE_FIELDS = ["clientPhone", "customerPhone", "patientPhone"] as const;

// ── Who is checked ───────────────────────────────────────────────────────────

export interface ScheduleChecks {
  readonly hours: boolean;
  readonly conflicts: boolean;
}

/**
 * Staff (and any role without "appointments.overbook") is always checked for business hours and conflicts.
 * The owner skips both only when the request says so (the screen asks first).
 */
export function scheduleChecksFor(role: Role, wantsOverride: boolean): ScheduleChecks {
  const skip = wantsOverride && can(role, "appointments.overbook");
  return { hours: !skip, conflicts: !skip };
}

export function isEditableStatus(status: string): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function findNonEditableField(body: Record<string, unknown>): string | null {
  return NON_EDITABLE_FIELDS.find((field) => body[field] !== undefined) ?? null;
}

// ── Field parsers ────────────────────────────────────────────────────────────

const emailSchema = z.string().email();

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown, max: number): string | null | "too_long" {
  const t = text(value);
  if (!t) return null;
  return t.length > max ? "too_long" : t;
}

function parseDate(value: unknown, now: Date): RuleResult<Date> {
  const d = typeof value === "string" ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return { ok: false, error: "date_invalid" };
  if (d.getTime() <= now.getTime()) return { ok: false, error: "date_in_past" };
  if (d.getTime() > now.getTime() + MAX_DAYS_AHEAD * DAY_MS) return { ok: false, error: "date_too_far" };
  return { ok: true, data: d };
}

/** A new or changed patient name needs a first name and a surname (ticket #113). */
function parseName(value: unknown): RuleResult<string> {
  const name = text(value).replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "name_required" };
  if (name.length > MAX_NAME) return { ok: false, error: "validation_failed" };
  return isPlausibleFullName(name) ? { ok: true, data: name } : { ok: false, error: "full_name_required" };
}

function parseEmail(value: unknown): RuleResult<string | null> {
  const email = text(value).toLowerCase();
  if (!email) return { ok: true, data: null };
  if (email.length > MAX_EMAIL) return { ok: false, error: "email_invalid" };
  return emailSchema.safeParse(email).success ? { ok: true, data: email } : { ok: false, error: "email_invalid" };
}

function parseModality(value: unknown): RuleResult<Modality | null> {
  if (value === undefined || value === null || value === "") return { ok: true, data: null };
  return value === "IN_PERSON" || value === "ONLINE" ? { ok: true, data: value } : { ok: false, error: "validation_failed" };
}

function parseAgeField(value: unknown): RuleResult<number> {
  const age = parseAge(value);
  return age === null ? { ok: false, error: "age_required" } : { ok: true, data: age };
}

/** The visit's reason, shared by the panel and the customer's own PATCH: empty is null, too long or not text is refused. */
export function parseNotesField(value: unknown): RuleResult<string | null> {
  if (value !== undefined && value !== null && typeof value !== "string") return { ok: false, error: "validation_failed" };
  const notes = optionalText(value, MAX_NOTES);
  return notes === "too_long" ? { ok: false, error: "validation_failed" } : { ok: true, data: notes };
}

const parseNotes = parseNotesField;

function asRecord(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface PanelCreate {
  readonly productId: string;
  readonly appointmentDate: Date;
  readonly clientName: string;
  readonly clientPhone: string;
  readonly clientAge: number;
  readonly clientEmail: string | null;
  readonly modality: Modality | null;
  readonly notes: string | null;
  /** The patient confirmed on the call: the visit starts confirmed and the reminder does not ask SI (D1). */
  readonly alreadyConfirmed: boolean;
  /** Staff recorded that the patient agreed to receive WhatsApp for this visit (strict consent). */
  readonly whatsappConsent: boolean;
  /** Owner only: book outside business hours or on top of another visit, after the warning. */
  readonly override: boolean;
  readonly petName: string | null;
  readonly petSpecies: string | null;
  /** Booking for another person (D11): the phone of who asked for it; null when the patient books for themself. */
  readonly requesterPhone: string | null;
}

/**
 * The panel no longer books for another person (ticket #113): the option is hidden and these fields are refused, so a
 * stale form or a hand-made request cannot use it. The WhatsApp bot still books for others (bot/book).
 */
const OTHER_PERSON_FIELDS = ["forOtherPerson", "requesterPhone", "patientPhone"] as const;

function refuseOtherPerson(b: Record<string, unknown>): RuleResult<null> {
  const sent = OTHER_PERSON_FIELDS.some((field) => b[field] !== undefined && b[field] !== null && b[field] !== false && b[field] !== "");
  return sent ? { ok: false, error: "field_not_allowed" } : { ok: true, data: null };
}

// Kept for when booking for another person comes back to the panel; not called while the option is off.
export function parseRequester(b: Record<string, unknown>, patientPhone: string): RuleResult<string | null> {
  if (b.forOtherPerson !== true) return { ok: true, data: null };
  const requester = text(b.requesterPhone);
  const requesterKey = requester.length <= MAX_PHONE ? patientKeyOf(requester) : null;
  if (!requesterKey) return { ok: false, error: "requester_phone_required" };
  if (requesterKey === patientKeyOf(patientPhone)) return { ok: false, error: "other_person_same_phone" };
  return { ok: true, data: requester };
}

export function parsePanelCreate(body: unknown, now: Date): RuleResult<PanelCreate> {
  const b = asRecord(body);
  if (!b || !text(b.productId) || b.appointmentDate === undefined || b.appointmentDate === "") {
    return { ok: false, error: "service_and_date_required" };
  }
  if (text(b.productId).length > MAX_ID) return { ok: false, error: "validation_failed" };
  const date = parseDate(b.appointmentDate, now);
  if (!date.ok) return date;
  const name = parseName(b.clientName);
  if (!name.ok) return name;
  const phone = text(b.clientPhone);
  if (phone.length > MAX_PHONE || !patientKeyOf(phone)) return { ok: false, error: "phone_required" };
  const age = parseAgeField(b.clientAge);
  if (!age.ok) return age;
  const email = parseEmail(b.clientEmail);
  if (!email.ok) return email;
  const modality = parseModality(b.modality);
  if (!modality.ok) return modality;
  const notes = parseNotes(b.notes);
  if (!notes.ok) return notes;
  const petName = optionalText(b.petName, MAX_PET_NAME);
  const petSpecies = optionalText(b.petSpecies, MAX_PET_NAME);
  if (petName === "too_long" || petSpecies === "too_long") return { ok: false, error: "validation_failed" };
  const requester = refuseOtherPerson(b);
  if (!requester.ok) return requester;

  return {
    ok: true,
    data: {
      productId: text(b.productId),
      appointmentDate: date.data,
      clientName: name.data,
      clientPhone: phone,
      clientAge: age.data,
      clientEmail: email.data,
      modality: modality.data,
      notes: notes.data,
      alreadyConfirmed: b.alreadyConfirmed === true,
      whatsappConsent: b.whatsappConsent === true,
      override: b.override === true,
      petName,
      petSpecies,
      requesterPhone: requester.data,
    },
  };
}

// ── Edit ─────────────────────────────────────────────────────────────────────

export interface PanelEdit {
  readonly productId?: string;
  readonly appointmentDate?: Date;
  readonly clientName?: string;
  readonly clientAge?: number;
  readonly clientEmail?: string | null;
  readonly modality?: Modality | null;
  readonly notes?: string | null;
  readonly override: boolean;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Only the fields that were sent are returned; each is validated like a booking. The phone is refused. */
export function parsePanelEdit(body: unknown, now: Date): RuleResult<PanelEdit> {
  const b = asRecord(body);
  if (!b) return { ok: false, error: "validation_failed" };
  if (findNonEditableField(b)) return { ok: false, error: "field_not_editable" };

  const out: Mutable<PanelEdit> = { override: b.override === true };
  if (b.productId !== undefined) {
    if (!text(b.productId)) return { ok: false, error: "service_and_date_required" };
    if (text(b.productId).length > MAX_ID) return { ok: false, error: "validation_failed" };
    out.productId = text(b.productId);
  }
  if (b.appointmentDate !== undefined) {
    const date = parseDate(b.appointmentDate, now);
    if (!date.ok) return date;
    out.appointmentDate = date.data;
  }
  if (b.clientName !== undefined) {
    const name = parseName(b.clientName);
    if (!name.ok) return name;
    out.clientName = name.data;
  }
  if (b.clientAge !== undefined) {
    const age = parseAgeField(b.clientAge);
    if (!age.ok) return age;
    out.clientAge = age.data;
  }
  if (b.clientEmail !== undefined) {
    const email = parseEmail(b.clientEmail);
    if (!email.ok) return email;
    out.clientEmail = email.data;
  }
  if (b.modality !== undefined) {
    const modality = parseModality(b.modality);
    if (!modality.ok) return modality;
    out.modality = modality.data;
  }
  if (b.notes !== undefined) {
    const notes = parseNotes(b.notes);
    if (!notes.ok) return notes;
    out.notes = notes.data;
  }
  return { ok: true, data: out };
}

// ── Calendar event ───────────────────────────────────────────────────────────

export interface CalendarFields {
  readonly appointmentDate: Date;
  readonly durationMinutes: number;
  readonly productId: string;
  readonly customerName: string | null;
  readonly customerAge: number | null;
  readonly notes: string | null;
  readonly modality: Modality | null;
  readonly customerEmail: string | null;
}

/** "none": leave the event; "update": new time or text; "recreate": new video link, address or guest. */
export type CalendarEffect = "none" | "update" | "recreate";

export function calendarEffectOf(before: CalendarFields, after: CalendarFields): CalendarEffect {
  if (before.modality !== after.modality || before.customerEmail !== after.customerEmail) return "recreate";
  const changed =
    before.appointmentDate.getTime() !== after.appointmentDate.getTime() ||
    before.durationMinutes !== after.durationMinutes ||
    before.productId !== after.productId ||
    before.customerName !== after.customerName ||
    before.customerAge !== after.customerAge ||
    before.notes !== after.notes;
  return changed ? "update" : "none";
}

// ── Delete / restore history ─────────────────────────────────────────────────

/** The role written to appointment_trail. Only the owner and staff delete or restore visits. */
export function trailRoleOf(role: Role): "ADMIN" | "STAFF" | null {
  return role === "ADMIN" || role === "STAFF" ? role : null;
}

// ── Restore and reopen (D14 to D17) ──────────────────────────────────────────

export type RestoreCheck = { readonly ok: true } | { readonly ok: false; readonly error: "restore_window_closed" };

/** A deleted visit can come back only before its start time. The slot check (free for everyone) is done by the caller. */
export function restoreCheck(visit: { readonly appointmentDate: Date }, now: Date): RestoreCheck {
  return visit.appointmentDate.getTime() > now.getTime() ? { ok: true } : { ok: false, error: "restore_window_closed" };
}

/**
 * What a status change back to an active status needs (owner decision of 2026-11-14, after the security review):
 * - "none": it is not a reopen (already active, or going to an inactive status).
 * - "check_slot": a future visit coming back from cancelled, no-show or attended: its slot must be free, for every
 *   role, and its calendar event comes back. Nobody puts two active visits on one time this way.
 * - "window_closed": a cancelled visit whose time has come (same as a restore).
 * - "allow": a past no-show or attended visit corrected by mistake: no slot to take, no reminder, no event.
 */
export type ReopenPlan = "none" | "check_slot" | "window_closed" | "allow";

export function reopenPlanFor(fromStatus: string, toStatus: string, appointmentDate: Date, now: Date): ReopenPlan {
  if (ACTIVE_STATUSES.includes(fromStatus) || !ACTIVE_STATUSES.includes(toStatus)) return "none";
  if (appointmentDate.getTime() > now.getTime()) return "check_slot";
  return fromStatus === "CANCELLED" ? "window_closed" : "allow";
}

// ── What the card offers (ticket #113) ───────────────────────────────────────
// The card asks these instead of copying the rule, so a button is shown only when the server would accept it.

/** "Recuperar" on a deleted visit: only before its start time. */
export function canOfferRestore(appointmentDate: Date, now: Date): boolean {
  return restoreCheck({ appointmentDate }, now).ok;
}

/** "Reabrir" on a cancelled, no-show or attended visit: not when the server would answer that the window closed. */
export function canOfferReopen(fromStatus: string, appointmentDate: Date, now: Date): boolean {
  const plan = reopenPlanFor(fromStatus, "CONFIRMED", appointmentDate, now);
  return plan === "check_slot" || plan === "allow";
}
