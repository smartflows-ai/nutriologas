// src/lib/whatsapp-number.ts
// Compares two WhatsApp numbers the way the platform stores them. Pure functions, no I/O.
// Used so an owner's number can never be the same line the bot (or the platform sender) sends from.

// Digits only: "+52 55-1234 5678" becomes "525512345678".
export function normalizeWhatsAppDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  // Mexican mobile numbers appear as 521 + 10 digits in WhatsApp and as 52 + 10 digits elsewhere.
  if (digits.length === 13 && digits.startsWith("521")) return `52${digits.slice(3)}`;
  return digits;
}

// True only when both numbers are present and are the same line.
export function isSameWhatsAppNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = normalizeWhatsAppDigits(a);
  const right = normalizeWhatsAppDigits(b);
  if (!left || !right) return false;
  return left === right;
}
