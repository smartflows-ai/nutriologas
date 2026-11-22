// src/lib/time-zone-change.ts
// What changing the business time zone does to the visits already booked (ticket #127). Pure and client-safe.
// A visit is stored as one instant (R1 of #111), so on a new zone it keeps the moment and shows another hour:
// the owner sees that list before saving and confirms it. Nothing is moved here.
// sameClock decides when two zone names are the same hour (Monterrey and Mexico City), so an address in Monterrey
// with the zone of Mexico City is not reported as a mismatch.
import { clinicDateKeyOf, clinicOffsetOf, clinicTimeOf } from "./clinic-time";
import { insideBusinessHours, type BusinessHours } from "./business-hours";

const DAY_MS = 86_400_000;
/** How far ahead two zones must agree: a year covers both daylight saving changes. */
const SAME_CLOCK_DAYS = 366;

export interface ShiftVisitInput {
  id: string;
  appointmentDate: Date;
  customerName: string | null;
  productName: string;
}

export interface ShiftedVisit {
  id: string;
  customerName: string | null;
  productName: string;
  /** Day and HH:mm the visit shows today, on the saved zone. */
  fromDate: string;
  fromTime: string;
  /** Day and HH:mm the same visit will show on the new zone. */
  toDate: string;
  toTime: string;
  /** True when, on the new zone, the visit starts outside the weekly hours. */
  outsideHours: boolean;
}

/** True when both zones give the same hour on every day of the next year (counted from `from`). */
export function sameClock(a: string, b: string, from: Date, days: number = SAME_CLOCK_DAYS): boolean {
  if (a === b) return true;
  for (let day = 0; day <= days; day++) {
    const instant = new Date(from.getTime() + day * DAY_MS);
    if (clinicOffsetOf(instant, a) !== clinicOffsetOf(instant, b)) return false;
  }
  return true;
}

/**
 * The visits whose day or hour reads differently once the zone changes from `fromZone` to `toZone`, in the order
 * given. Empty when the zones are the same clock. The caller passes only the visits that matter (future and active).
 */
export function zoneShiftImpact(
  visits: readonly ShiftVisitInput[],
  fromZone: string,
  toZone: string,
  hours: BusinessHours,
): ShiftedVisit[] {
  if (fromZone === toZone) return [];
  return visits
    .map((visit) => {
      const fromDate = clinicDateKeyOf(visit.appointmentDate, fromZone);
      const fromTime = clinicTimeOf(visit.appointmentDate, fromZone);
      const toDate = clinicDateKeyOf(visit.appointmentDate, toZone);
      const toTime = clinicTimeOf(visit.appointmentDate, toZone);
      return {
        id: visit.id,
        customerName: visit.customerName,
        productName: visit.productName,
        fromDate,
        fromTime,
        toDate,
        toTime,
        outsideHours: !insideBusinessHours(hours, toDate, toTime),
      };
    })
    .filter((shifted) => shifted.fromDate !== shifted.toDate || shifted.fromTime !== shifted.toTime);
}
