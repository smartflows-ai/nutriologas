// src/lib/booking-limit.ts
// Ticket #141: a person can have at most MAX_ACTIVE_VISITS_PER_DAY active visits on one day through the bot; the next
// one is not booked and the chat goes to a person. Pure rules, no I/O: booking-limit-data.ts counts the visits and the
// bot routes call these. The day is the business's own day (Tenant.timeZone), never the UTC day.
import { addClinicDays, clinicDateTime } from "@/lib/clinic-time";

/** Active visits one person may have on the same day; a business-level setting may replace it later. */
export const MAX_ACTIVE_VISITS_PER_DAY = 3;

/** Only these visits count: a cancelled, completed or missed one does not hold the day. Deleted ones are never read. */
export const ACTIVE_VISIT_STATUSES = ["PENDING", "CONFIRMED"] as const;

export interface DayCounts {
  /** Active visits that day of the person the visit is for. */
  patient: number;
  /** Active visits that day of the person writing: their own and the ones they booked for others. */
  writer: number;
}

export type LimitDecision = { allowed: true } | { allowed: false; by: "patient" | "writer"; count: number; max: number };

/** The fourth visit is the one refused: it is allowed while the count is below the maximum. */
export function limitDecision(counts: DayCounts, max: number = MAX_ACTIVE_VISITS_PER_DAY): LimitDecision {
  if (counts.patient >= max) return { allowed: false, by: "patient", count: counts.patient, max };
  if (counts.writer >= max) return { allowed: false, by: "writer", count: counts.writer, max };
  return { allowed: true };
}

/** Which visits are counted for one person: a plain match on their key, or their own plus the ones they booked. */
export type VisitScope = { patientKey: string } | { OR: [{ patientKey: string }, { referredByKey: string }] };

/**
 * What the two counts look at. The patient: their own visits. The person writing: their own visits AND the ones they
 * booked for others (referredByKey), also when they book for themselves, so a mother who booked three children and then
 * asks for her own visit that day is counted four times. The writer count already includes the patient's own visits when
 * both are the same person, so the patient query is skipped then (`patient: null`).
 */
export function visitScopes(patientKey: string, writerKey: string | null): { patient: VisitScope | null; writer: VisitScope | null } {
  const writer: VisitScope | null = writerKey ? { OR: [{ patientKey: writerKey }, { referredByKey: writerKey }] } : null;
  return { patient: writerKey === patientKey ? null : { patientKey }, writer };
}

/** The business day of a YYYY-MM-DD date as an instant range [start, end): midnight to midnight in the zone. */
export function dayRangeOf(dateKey: string, zone: string): { start: Date; end: Date } {
  return {
    start: new Date(clinicDateTime(dateKey, "00:00", zone)),
    end: new Date(clinicDateTime(addClinicDays(dateKey, 1), "00:00", zone)),
  };
}

/**
 * The answer the bot tools get when the limit is reached. The message is for the agent, who says it with its own
 * words: it never names a provider or one kind of business. With no chat to hand over, it must not promise a person.
 */
export function dailyLimitBody(handedOff: boolean, max: number = MAX_ACTIVE_VISITS_PER_DAY) {
  return {
    success: false as const,
    error: "daily_limit_reached" as const,
    max,
    handedOff,
    message: handedOff
      ? `No agendes esta cita y no ofrezcas otro horario de ese dia: ya se llego al limite de ${max} citas por dia. Dile al cliente, con tus palabras, que una persona del equipo lo atendera en esta conversacion.`
      : `No agendes esta cita y no ofrezcas otro horario de ese dia: ya se llego al limite de ${max} citas por dia. No prometas que una persona lo atendera; explica que ese dia no se pueden agendar mas citas y ofrece otro dia.`,
  };
}
