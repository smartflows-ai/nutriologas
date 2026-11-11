// src/lib/patient-intake.ts
// Rules for the first booking of a patient (name, age, optional email) and for the visit modality
// (in person or online). Pure functions, no I/O: the routes load the data and call these.

import { patientKeyOf } from "@/lib/patient-key";

// A "known patient" is a WhatsApp number that already has an appointment in the business. Its name, email and
// age come from the latest visit (see getKnownPatient in patients.ts), so the bot never asks them twice.

export type ServiceModes = "IN_PERSON" | "ONLINE" | "BOTH";
export type Modality = "IN_PERSON" | "ONLINE";
/** What the bot does about the modality: nothing (a single mode) or ask the patient. */
export type ModalityMode = Modality | "ASK";

export interface KnownPatient {
  name: string | null;
  email: string | null;
  age: number | null;
}

export type IntakeField = "name" | "age";

export interface IntakeInput {
  name?: unknown;
  age?: unknown;
  email?: unknown;
}

const MAX_AGE = 120;
const MODALITIES: readonly string[] = ["IN_PERSON", "ONLINE"];

export function modalityModeOf(serviceModes: ServiceModes): ModalityMode {
  return serviceModes === "BOTH" ? "ASK" : serviceModes;
}

export type ModalityResult =
  | { ok: true; modality: Modality }
  | { ok: false; error: "modality_required" | "modality_not_available" };

/**
 * Modes a service can be delivered in. The business setting is the default; a service that sets its own modes
 * (`visitModes`, null = follows the business) overrides it, so no combination is invalid.
 */
export function effectiveModes(business: ServiceModes, service: ServiceModes | null): Modality[] {
  const modes = service ?? business;
  return modes === "BOTH" ? ["IN_PERSON", "ONLINE"] : [modes];
}

/** What the bot and the booking form do for a service: nothing (a single mode, tell the customer) or ask. */
export function modalityModeFor(business: ServiceModes, service: ServiceModes | null): ModalityMode {
  return modalityModeOf(service ?? business);
}

/**
 * A single-mode business decides by itself; a business that offers both needs the patient's choice. Passing the
 * service's own modes (null when it follows the business) applies the per-service rule: a single effective mode
 * decides alone and refuses the other one (`modality_not_available`). Without that argument (old callers) a
 * single-mode business keeps ignoring what was requested.
 */
export function resolveModality(
  serviceModes: ServiceModes,
  requested: unknown,
  serviceVisitModes?: ServiceModes | null
): ModalityResult {
  const perService = serviceVisitModes !== undefined;
  const allowed = effectiveModes(serviceModes, perService ? serviceVisitModes : null);
  const chosen = typeof requested === "string" && MODALITIES.includes(requested) ? (requested as Modality) : null;
  if (allowed.length === 1) {
    if (perService && chosen && chosen !== allowed[0]) return { ok: false, error: "modality_not_available" };
    return { ok: true, modality: allowed[0] };
  }
  return chosen ? { ok: true, modality: chosen } : { ok: false, error: "modality_required" };
}

export function isValidAge(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_AGE;
}

/** Age typed as a number or as plain digits ("34"). Anything else, or out of range, gives null. */
export function parseAge(value: unknown): number | null {
  const age = typeof value === "string" && /^\s*\d{1,3}\s*$/.test(value) ? Number(value) : value;
  return isValidAge(age) ? age : null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** What the bot still has to ask. A known patient is never asked; the email is only offered to a new one. */
export function intakeNeeds(known: KnownPatient | null): { askName: boolean; askAge: boolean; askEmail: boolean } {
  const isNew = known === null;
  return { askName: isNew, askAge: isNew, askEmail: isNew };
}

/** Required fields still missing in a booking request. The email is optional, so it never appears here. */
export function missingIntake(known: KnownPatient | null, input: IntakeInput): IntakeField[] {
  if (known) return [];
  const missing: IntakeField[] = [];
  if (!cleanText(input.name)) missing.push("name");
  if (parseAge(input.age) === null) missing.push("age");
  return missing;
}

/** What is sent wins; the stored record fills what the agent left out. */
export function mergePatient(
  known: KnownPatient | null,
  input: IntakeInput
): { name: string | null; email: string | null; age: number | null } {
  return {
    name: cleanText(input.name) || known?.name || null,
    email: cleanText(input.email).toLowerCase() || known?.email || null,
    age: parseAge(input.age) ?? known?.age ?? null,
  };
}

export type BookingPhoneResult =
  | { ok: true; phone: string; forOther: boolean }
  | { ok: false; error: "invalid_patient_phone" };

/**
 * The phone the visit is saved under. Normally the number that writes to the bot; when the customer books for
 * someone else the bot sends that person's number, so the history, the reminder and the confirmation reply go to
 * them. The sender's own number written in another format is still the sender.
 */
export function resolveBookingPhone(senderPhone: string, patientPhone: unknown): BookingPhoneResult {
  const typed = typeof patientPhone === "string" ? patientPhone.trim() : "";
  if (!typed) return { ok: true, phone: senderPhone, forOther: false };
  const key = patientKeyOf(typed);
  if (!key) return { ok: false, error: "invalid_patient_phone" };
  if (key === patientKeyOf(senderPhone)) return { ok: true, phone: senderPhone, forOther: false };
  return { ok: true, phone: key, forOther: true };
}

/** Courtesy titles some people type before their name ("Dra. Ana"): they are not the first name. */
const NAME_TITLES: ReadonlySet<string> = new Set(["dr", "dra", "sr", "sra", "lic", "ing"]);

/** First word of a name (titles skipped), lowercase and without accents, to tell who a visit is for. Empty when there is none. */
function firstNameKey(name: unknown): string {
  const words = cleanText(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(" ");
  return words.find((word) => word !== "" && !NAME_TITLES.has(word.replace(/\.$/, ""))) ?? "";
}

/**
 * True when a known sender books under another first name and no other number came with the request: the agent
 * most likely dropped the other person's phone (ticket #72), and saving it would put that person's visit, reminder
 * and data under the sender's number. No name sent (the registered one is used), an unknown sender or a sender
 * without a registered name cannot be compared. A nickname also counts as another name: the bot then asks.
 */
export function isOtherPersonsName(known: KnownPatient | null, typedName: unknown): boolean {
  const typed = firstNameKey(typedName);
  const registered = firstNameKey(known?.name);
  return typed !== "" && registered !== "" && typed !== registered;
}

/** The number a visit's messages go to, shown back with only its last four digits. Null when there is none. */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `…${digits.slice(-4)}` : null;
}

export interface Referral {
  referredByKey: string | null;
  referredByName: string | null;
}

/**
 * A visit booked for someone else is an automatic recommendation: it remembers who wrote (their phone key and
 * name at that moment). A visit for the person writing has none.
 */
export function referralOf(forOther: boolean, senderPhone: string, senderName: string | null): Referral {
  if (!forOther) return { referredByKey: null, referredByName: null };
  return { referredByKey: patientKeyOf(senderPhone), referredByName: senderName };
}

/** The booker's name from the WhatsApp profile: trimmed, single spaces, at most 80 characters, null when empty. */
export function cleanSenderName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  return name || null;
}

/**
 * Where-clause for "the visits of the person writing": their own (by the typed phone or by patientKey, because a
 * visit booked for them is saved under the 52 + 10 digits key while WhatsApp writes 521 + 10 digits), and the ones
 * they booked for others.
 */
export function visitsOfSender(senderPhone: string): {
  OR: Array<{ customerPhone: string } | { patientKey: string } | { referredByKey: string }>;
} {
  const key = patientKeyOf(senderPhone);
  return { OR: [{ customerPhone: senderPhone }, ...(key ? [{ patientKey: key }, { referredByKey: key }] : [])] };
}

const GUEST_EMAIL_DOMAIN = "wa.guest.local";
const SYNTHETIC_EMAIL = /@(wa\.guest|booking)\.local$/i;

/** Stable placeholder login for a patient without email, so every visit of that phone reuses one account. */
export function guestEmailFor(patientKey: string): string {
  return `${patientKey}@${GUEST_EMAIL_DOMAIN}`;
}

/** True for the placeholder addresses the platform creates; they are never shown or mailed. */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && SYNTHETIC_EMAIL.test(email);
}
