// src/lib/free-slots.ts
// The nearest free times around a wanted one, for every "slot taken" answer: the panel, a restore and the
// WhatsApp bot (ticket #103, D10). Uses the same rules as the availability routes: business hours, the service
// duration, native visits and the connected calendar, and no time that has already passed.
import { buildSlot } from "@/lib/bot";
import { daySlots, type BusinessHours } from "@/lib/business-hours";
import { getBusyPeriods, isSlotFree } from "@/lib/calendar-sync";
import { addClinicDays, clinicDateKeyOf, clinicDateTime, clinicTimeOf } from "@/lib/clinic-time";
import { clinicLongDate, clinicTime } from "@/lib/reminder-messages";
import { ALTERNATIVES_OFFERED, nearestSlots, type SlotRef } from "@/lib/nearest-slots";

/** Days looked at: the day before the wanted one and the next few, never before today. */
const DAYS_BEFORE = 1;
const DAYS_AFTER = 3;

export interface FreeSlot extends SlotRef {
  /** The same time as an ISO date with the business offset, ready to send back as appointmentDate. */
  readonly iso: string;
}

export interface NearestFreeInput {
  readonly tenantId: string;
  /** The business time zone (IANA): days and times are read on its clock. */
  readonly zone: string;
  readonly hours: BusinessHours;
  readonly durationMinutes: number;
  readonly target: Date;
  readonly now: Date;
  /** A visit being moved does not block its own slot. */
  readonly exclude?: { readonly appointmentId: string; readonly externalEventId: string | null };
  readonly limit?: number;
}

async function freeTimesOf(input: NearestFreeInput, date: string): Promise<SlotRef[]> {
  const busy = await getBusyPeriods(input.tenantId, date, input.zone);
  return daySlots(input.hours, date, input.durationMinutes)
    .filter((time) => {
      const slot = buildSlot(date, time, input.durationMinutes, input.hours, input.zone);
      return slot !== null && slot.start.getTime() > input.now.getTime() && isSlotFree(busy, slot.start, slot.end, input.exclude);
    })
    .map((time) => ({ date, time }));
}

export async function nearestFreeSlots(input: NearestFreeInput): Promise<FreeSlot[]> {
  const targetDay = clinicDateKeyOf(input.target, input.zone);
  const today = clinicDateKeyOf(input.now, input.zone);
  const days = Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, i) => addClinicDays(targetDay, i - DAYS_BEFORE)).filter(
    (day) => day >= today
  );
  const limit = input.limit ?? ALTERNATIVES_OFFERED;
  const target = { date: targetDay, time: clinicTimeOf(input.target, input.zone) };
  // The wanted day first: one calendar read usually finds enough; the other days only when it does not.
  const sameDay = days.includes(targetDay) ? await freeTimesOf(input, targetDay) : [];
  const others =
    sameDay.length >= limit ? [] : (await Promise.all(days.filter((d) => d !== targetDay).map((day) => freeTimesOf(input, day)))).flat();
  return nearestSlots([...sameDay, ...others], target, limit).map((s) => ({
    ...s,
    iso: clinicDateTime(s.date, s.time, input.zone),
  }));
}

/**
 * The bot's answer when the time was taken a second earlier (ticket #103, D10): the same error code as before,
 * plus the nearest free times in the message the agent reads and as data (date and time, ready for the next call).
 * The agent offers them in the same reply, so the customer never gets a bare "not available".
 */
export async function botSlotTakenBody(input: NearestFreeInput): Promise<Record<string, unknown>> {
  const alternatives = await nearestFreeSlots(input);
  return {
    success: false,
    error: "slot_unavailable",
    message: `Ese horario se acaba de ocupar. ${alternativesSentence(alternatives, input.zone)} Ofrécelos al cliente en esta misma respuesta.`,
    alternatives: alternatives.map(({ date, time }) => ({ date, time })),
  };
}

/** Spanish sentence for the WhatsApp agent: "Los horarios libres más cercanos son ...". */
export function alternativesSentence(slots: readonly FreeSlot[], zone: string): string {
  if (slots.length === 0) return "No hay horarios libres cercanos; ofrece revisar otro día.";
  const items = slots.map((s) => {
    const at = new Date(s.iso);
    return `${clinicLongDate(at, "es", zone)} a las ${clinicTime(at, "es", zone)}`;
  });
  const list = items.join("; ");
  // A time ending in "p.m." already closes the sentence: no second period.
  return `Los horarios libres más cercanos son: ${list}${list.endsWith(".") ? "" : "."}`;
}
