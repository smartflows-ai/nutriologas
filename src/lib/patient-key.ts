// src/lib/patient-key.ts
// A patient is identified inside a tenant by the digits of their WhatsApp phone, so web and bot bookings of the
// same person share one notes history. "+52 844 668 3688", "5218446683688" and "528446683688" give the same key.

/**
 * Digits only, normalized to the Mexican form (country code 52 + 10 digits):
 * - "521" + 10 digits (WhatsApp mobile) becomes "52" + 10 digits, the same as web bookings.
 * - 10 digits without a country code get the platform default, 52 (the default dial code is +52).
 * Returns null when there is no usable phone (fewer than 8 digits).
 */
export function patientKeyOf(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("521")) {
    digits = "52" + digits.slice(3);
  } else if (digits.length === 10) {
    digits = "52" + digits;
  }
  return digits.length >= 8 ? digits : null;
}
