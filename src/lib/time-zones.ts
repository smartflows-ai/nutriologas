// src/lib/time-zones.ts
// The time zones a business can pick in /admin/negocio, how the owner and the patient read them, and the first
// suggestion when the business has no address (ticket #111). Pure and client-safe.
// The zone itself comes from the address through Google (src/lib/time-zone-lookup.ts); this list is for correcting it
// and for businesses with no physical place. A zone detected outside the list is still valid (see timeZoneOptionsFor).
import { DEFAULT_TIME_ZONE } from "./clinic-time";

type Language = "es" | "en";

export interface TimeZoneOption {
  /** IANA name stored in Tenant.timeZone. */
  value: string;
  /** What the owner reads in the list. */
  owner: Record<Language, string>;
  /** What the patient reads next to a time: "hora de Cancún". */
  patient: Record<Language, string>;
}

const option = (value: string, ownerEs: string, ownerEn: string, cityEs: string, cityEn: string): TimeZoneOption => ({
  value,
  owner: { es: ownerEs, en: ownerEn },
  patient: { es: `hora de ${cityEs}`, en: `${cityEn} time` },
});

export const TIME_ZONE_OPTIONS: readonly TimeZoneOption[] = [
  option("America/Mexico_City", "México, Centro (CDMX, Guadalajara, Monterrey)", "Mexico, Central (Mexico City, Guadalajara, Monterrey)", "Ciudad de México", "Mexico City"),
  option("America/Cancun", "México, Quintana Roo (Cancún)", "Mexico, Quintana Roo (Cancun)", "Cancún", "Cancun"),
  option("America/Mazatlan", "México, Pacífico (Sinaloa, Nayarit, Baja California Sur)", "Mexico, Pacific (Sinaloa, Nayarit, Baja California Sur)", "Mazatlán", "Mazatlan"),
  option("America/Hermosillo", "México, Sonora (Hermosillo)", "Mexico, Sonora (Hermosillo)", "Hermosillo", "Hermosillo"),
  option("America/Tijuana", "México, Baja California (Tijuana, Mexicali)", "Mexico, Baja California (Tijuana, Mexicali)", "Tijuana", "Tijuana"),
  option("America/New_York", "Estados Unidos, Este (Nueva York, Miami)", "United States, Eastern (New York, Miami)", "Nueva York", "New York"),
  option("America/Chicago", "Estados Unidos, Centro (Chicago, Houston, Dallas)", "United States, Central (Chicago, Houston, Dallas)", "Chicago", "Chicago"),
  option("America/Denver", "Estados Unidos, Montaña (Denver)", "United States, Mountain (Denver)", "Denver", "Denver"),
  option("America/Los_Angeles", "Estados Unidos, Pacífico (Los Ángeles, San Diego)", "United States, Pacific (Los Angeles, San Diego)", "Los Ángeles", "Los Angeles"),
  option("America/Bogota", "Colombia (Bogotá)", "Colombia (Bogota)", "Bogotá", "Bogota"),
  option("America/Lima", "Perú (Lima)", "Peru (Lima)", "Lima", "Lima"),
  option("America/Santiago", "Chile (Santiago)", "Chile (Santiago)", "Santiago", "Santiago"),
  option("America/Argentina/Buenos_Aires", "Argentina (Buenos Aires)", "Argentina (Buenos Aires)", "Buenos Aires", "Buenos Aires"),
  option("Europe/Madrid", "España (Madrid)", "Spain (Madrid)", "Madrid", "Madrid"),
];

const languageOf = (language: string | null | undefined): Language => (language === "en" ? "en" : "es");

/** "Bahia Banderas" for "America/Bahia_Banderas": the last part of the IANA name, readable. */
function cityOf(zone: string): string {
  const last = zone.split("/").pop() ?? zone;
  return last.replace(/_/g, " ");
}

/** What the patient reads next to a time: "hora de Cancún" / "Cancun time", also for a zone outside the list. */
export function timeZoneLabel(zone: string, language: string | null | undefined): string {
  const lang = languageOf(language);
  const known = TIME_ZONE_OPTIONS.find((o) => o.value === zone);
  if (known) return known.patient[lang];
  if (zone === "UTC") return lang === "en" ? "UTC time" : "hora UTC";
  return lang === "en" ? `${cityOf(zone)} time` : `hora de ${cityOf(zone)}`;
}

/** The owner's list: the fixed options plus the business's current zone when Google detected one outside them. */
export function timeZoneOptionsFor(current: string | null | undefined): TimeZoneOption[] {
  if (!current || TIME_ZONE_OPTIONS.some((o) => o.value === current)) return [...TIME_ZONE_OPTIONS];
  const city = cityOf(current);
  return [...TIME_ZONE_OPTIONS, option(current, city, city, city, city)];
}

// Longest prefix first, so "+52" is not read as "+5".
const ZONE_BY_DIAL_CODE: ReadonlyArray<[string, string]> = [
  ["+52", "America/Mexico_City"],
  ["+57", "America/Bogota"],
  ["+51", "America/Lima"],
  ["+56", "America/Santiago"],
  ["+54", "America/Argentina/Buenos_Aires"],
  ["+34", "Europe/Madrid"],
  ["+1", "America/New_York"],
];

/** First suggestion for a business with no address, from its WhatsApp number (+<country code><digits>). */
export function suggestTimeZoneForPhone(phone: string | null | undefined): string {
  const clean = (phone ?? "").replace(/[^\d+]/g, "");
  const match = ZONE_BY_DIAL_CODE.find(([code]) => clean.startsWith(code));
  return match ? match[1] : DEFAULT_TIME_ZONE;
}
