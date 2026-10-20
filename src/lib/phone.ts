// src/lib/phone.ts
// Country dial codes for phone inputs, and the rule that turns a country + local number into E.164-style "+CC...".

export interface PhoneCountry {
  iso: string;
  dial: string;
}

export const DEFAULT_DIAL_CODE = "52";

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "MX", dial: "52" },
  { iso: "US", dial: "1" },
  { iso: "GT", dial: "502" },
  { iso: "SV", dial: "503" },
  { iso: "HN", dial: "504" },
  { iso: "NI", dial: "505" },
  { iso: "CR", dial: "506" },
  { iso: "PA", dial: "507" },
  { iso: "CO", dial: "57" },
  { iso: "VE", dial: "58" },
  { iso: "EC", dial: "593" },
  { iso: "PE", dial: "51" },
  { iso: "CL", dial: "56" },
  { iso: "AR", dial: "54" },
  { iso: "BR", dial: "55" },
  { iso: "ES", dial: "34" },
  { iso: "GB", dial: "44" },
];

// Builds "+<dial><local digits>". If the local input already starts with "+", it is a full
// international number and the selected dial code is ignored.
export function buildFullPhone(dial: string, localInput: string): string {
  const trimmed = localInput.trim();
  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  return `+${dial}${digits}`;
}

// Splits a stored number back into dial code and local digits, for editing. Numbers saved before the
// selector existed have no "+" and fall back to the default dial code.
export function splitFullPhone(stored: string): { dial: string; local: string } {
  const digits = stored.replace(/\D/g, "");
  const hasPlus = stored.trim().startsWith("+");
  if (hasPlus || digits.length > 10) {
    const match = [...PHONE_COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => digits.startsWith(c.dial));
    if (match) return { dial: match.dial, local: digits.slice(match.dial.length) };
  }
  return { dial: DEFAULT_DIAL_CODE, local: digits };
}
