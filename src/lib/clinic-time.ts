// src/lib/clinic-time.ts
// Clock helpers for a business's own time zone (Tenant.timeZone, an IANA name such as "America/Cancun").
// Client-safe: no server imports. Instants are stored in UTC; a zone is used only when a wall-clock time
// (YYYY-MM-DD and HH:mm picked by a person) comes in or goes out. Every function receives the zone: this module is
// the only place that converts (ticket #111), so no other file writes an offset such as "-06:00".

/** The zone every business had before the setting existed; the column default in prisma/sql/28-tenant-time-zone. */
export const DEFAULT_TIME_ZONE = "America/Mexico_City";

const IANA_NAME = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** True for a real IANA zone name ("America/Cancun", "UTC"); false for offsets ("-06:00"), labels or unknown names. */
export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || !IANA_NAME.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(zone, formatter);
  }
  return formatter;
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallPartsOf(ms: number, zone: string): WallParts {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(zone).formatToParts(new Date(ms))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/** Minutes the zone is ahead of UTC at that instant (-360 for Mexico City). */
function offsetMinutesAt(ms: number, zone: string): number {
  const wholeSecond = Math.floor(ms / 1000) * 1000;
  const p = wallPartsOf(wholeSecond, zone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wallAsUtc - wholeSecond) / MINUTE_MS);
}

function offsetText(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const mins = String(abs % 60).padStart(2, "0");
  return `${sign}${hours}:${mins}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ISO text of an instant on the zone's wall clock, with that day's offset: "2026-11-17T19:30:00-06:00". */
function isoInZone(ms: number, zone: string): string {
  const p = wallPartsOf(ms, zone);
  return (
    `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}` +
    offsetText(offsetMinutesAt(ms, zone))
  );
}

/** The instant (ms) of a wall-clock time in the zone. A repeated hour uses its first instant; a skipped one moves forward. */
function instantOf(date: string, time: string, zone: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // The offsets just before and just after any change that day: a zone never changes twice within 48 hours.
  const before = offsetMinutesAt(wall - DAY_MS, zone);
  const after = offsetMinutesAt(wall + DAY_MS, zone);
  const candidates = Array.from(new Set([wall - before * MINUTE_MS, wall - after * MINUTE_MS])).filter(
    (candidate) => candidate + offsetMinutesAt(candidate, zone) * MINUTE_MS === wall,
  );
  return candidates.length > 0 ? Math.min(...candidates) : wall - before * MINUTE_MS;
}

/** ISO instant of a wall-clock time picked in the business zone: clinicDateTime("2026-11-17", "19:30", zone). */
export function clinicDateTime(date: string, time: string, zone: string): string {
  return isoInZone(instantOf(date, time, zone), zone);
}

/** False for a time the clock skips that day (the hour lost when daylight saving time starts). */
export function isRealClinicTime(date: string, time: string, zone: string): boolean {
  const instant = new Date(instantOf(date, time, zone));
  return clinicDateKeyOf(instant, zone) === date && clinicTimeOf(instant, zone) === time;
}

/** The exact instant as ISO text on the business clock, with its offset: "2026-11-17T19:30:00-06:00". */
export function clinicIsoOf(date: Date, zone: string): string {
  return isoInZone(date.getTime(), zone);
}

/** The zone's offset on that instant's day: "-06:00", "+01:00". */
export function clinicOffsetOf(date: Date, zone: string): string {
  return offsetText(offsetMinutesAt(date.getTime(), zone));
}

/** YYYY-MM-DD of an instant, read on the business calendar. */
export function clinicDateKeyOf(date: Date, zone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: zone });
}

/** Adds whole days to a YYYY-MM-DD date (calendar arithmetic, no zone involved). */
export function addClinicDays(dateKey: string, days: number): string {
  const day = new Date(`${dateKey}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** HH:mm of an instant, read on the business clock. */
export function clinicTimeOf(date: Date, zone: string): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/**
 * Time of an instant as the bot and the Spanish messages write it ("07:30 p.m."), on the business clock.
 * The single source of that format: formatSlotTime (src/lib/bot.ts) calls it. Its 12 or 24 hour rule is decided in #114.
 */
export function clinicTimeLabel(date: Date, zone: string): string {
  return date.toLocaleTimeString("es-MX", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Lowercase Spanish weekday of an instant on the business calendar ("martes"), so the bot never works it out. */
export function clinicWeekdayOf(date: Date, zone: string): string {
  return date.toLocaleDateString("es-MX", { timeZone: zone, weekday: "long" });
}
