// src/lib/patient-intake.ts
// Rules for the first booking of a patient (name, age, optional email) and for the visit modality
// (in person or online). Pure functions, no I/O: the routes load the data and call these.
//
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

export type ModalityResult = { ok: true; modality: Modality } | { ok: false; error: "modality_required" };

/** A single-mode business decides by itself; a business that offers both needs the patient's choice. */
export function resolveModality(serviceModes: ServiceModes, requested: unknown): ModalityResult {
  const mode = modalityModeOf(serviceModes);
  if (mode !== "ASK") return { ok: true, modality: mode };
  if (typeof requested === "string" && MODALITIES.includes(requested)) {
    return { ok: true, modality: requested as Modality };
  }
  return { ok: false, error: "modality_required" };
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
