// src/lib/staff-whatsapp.ts
// The WhatsApp number of a staff member: where the notice "a chat needs help" is sent. Stored as "+" and 8 to 15
// digits, like the business number. Pure.
import { DEFAULT_DIAL_CODE } from "@/lib/phone";

const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

/** The number to store, null to clear it, or "invalid". Ten local digits get the default country code. */
export function normalizeStaffWhatsapp(input: unknown): string | null | "invalid" {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") return "invalid";
  const text = input.trim();
  if (text === "") return null;
  if (!/^\+?[\d\s().-]+$/.test(text)) return "invalid";
  let digits = text.replace(/\D/g, "");
  if (!text.startsWith("+") && digits.length === 10) digits = `${DEFAULT_DIAL_CODE}${digits}`;
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS ? `+${digits}` : "invalid";
}
