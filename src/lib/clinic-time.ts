// src/lib/clinic-time.ts
// Clock helpers for the clinic's timezone. Client-safe: no server imports.
// Wall-clock times the patient picks (HH:mm on a YYYY-MM-DD date) are clinic time, never UTC.

export const CLINIC_TIME_OFFSET = "-06:00"; // America/Mexico_City (CST, no DST)
const CLINIC_TIME_ZONE = "America/Mexico_City";

/** ISO instant for a wall-clock time in the clinic zone. */
export function clinicDateTime(date: string, time: string): string {
  return `${date}T${time}:00${CLINIC_TIME_OFFSET}`;
}

/** YYYY-MM-DD of an instant, read on the clinic calendar. */
export function clinicDateKeyOf(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: CLINIC_TIME_ZONE });
}

/** Adds whole days to a YYYY-MM-DD clinic date. */
export function addClinicDays(dateKey: string, days: number): string {
  const day = new Date(`${dateKey}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** HH:mm of an instant, read on the clinic clock. */
export function clinicTimeOf(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
