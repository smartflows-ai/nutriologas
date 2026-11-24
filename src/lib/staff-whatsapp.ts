// src/lib/staff-whatsapp.ts
// The WhatsApp number of a staff member: where the notice "a chat needs help" is sent. Stored as "+" and 8 to 15
// digits, like the business number. Pure.
import { DEFAULT_DIAL_CODE } from "@/lib/phone";

const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

/**
 * The number to store, null to clear it, or "invalid". Ten local digits get the business country code (`dialCode`,
 * from the business zone, ticket #120); Mexico when not given.
 */
export function normalizeStaffWhatsapp(input: unknown, dialCode: string = DEFAULT_DIAL_CODE): string | null | "invalid" {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") return "invalid";
  const text = input.trim();
  if (text === "") return null;
  if (!/^\+?[\d\s().-]+$/.test(text)) return "invalid";
  let digits = text.replace(/\D/g, "");
  if (!text.startsWith("+") && digits.length === 10) digits = `${dialCode}${digits}`;
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS ? `+${digits}` : "invalid";
}

const MEXICO_DIAL_CODE = "52";
const MEXICO_LOCAL_DIGITS = 10;

export type RequiredStaffWhatsapp =
  | { readonly ok: true; readonly number: string }
  | { readonly ok: false; readonly reason: "staff_whatsapp_required" | "staff_whatsapp_invalid" };

/**
 * Ticket #176: a staff member always has a number. Missing or blank is "required"; a bad one is "invalid"; a +52 number
 * needs exactly ten digits after the code. Same normalization as `normalizeStaffWhatsapp`.
 */
export function requireStaffWhatsapp(input: unknown, dialCode: string = DEFAULT_DIAL_CODE): RequiredStaffWhatsapp {
  const number = normalizeStaffWhatsapp(input, dialCode);
  if (number === null) return { ok: false, reason: "staff_whatsapp_required" };
  if (number === "invalid") return { ok: false, reason: "staff_whatsapp_invalid" };
  const isMexican = number.startsWith(`+${MEXICO_DIAL_CODE}`);
  if (isMexican && number.length !== 1 + MEXICO_DIAL_CODE.length + MEXICO_LOCAL_DIGITS) {
    return { ok: false, reason: "staff_whatsapp_invalid" };
  }
  return { ok: true, number };
}
