// src/lib/booking-limit.ts
// Ticket #141: a person can have at most MAX_ACTIVE_FUTURE_VISITS active visits that have not happened yet, on any day
// (a limit per day would let someone book three visits every day without end). Through the bot and the public web
// booking; the panel has no limit. Pure rules, no I/O: booking-limit-data.ts counts the visits.

/** Active future visits one person may hold in total; a business-level setting may replace it later. */
export const MAX_ACTIVE_FUTURE_VISITS = 3;

/** Only these visits count: a cancelled, completed or missed one does not hold a place. Deleted ones are never read. */
export const ACTIVE_VISIT_STATUSES = ["PENDING", "CONFIRMED"] as const;

/** Visits that have not happened yet: after `now`, injected so the rule is testable. */
export function futureRange(now: Date): { gt: Date } {
  return { gt: now };
}

export interface PersonCounts {
  /** Active future visits of the person the visit is for. */
  patient: number;
  /** Active future visits of the person writing: their own and the ones they booked for others. */
  writer: number;
}

export type LimitDecision = { allowed: true } | { allowed: false; by: "patient" | "writer"; count: number; max: number };

/** The fourth visit is the one refused: it is allowed while the count is below the maximum. */
export function limitDecision(counts: PersonCounts, max: number = MAX_ACTIVE_FUTURE_VISITS): LimitDecision {
  if (counts.patient >= max) return { allowed: false, by: "patient", count: counts.patient, max };
  if (counts.writer >= max) return { allowed: false, by: "writer", count: counts.writer, max };
  return { allowed: true };
}

/** Which visits are counted for one person: a plain match on their key, or their own plus the ones they booked. */
export type VisitScope =
  | { patientKey: string }
  | { OR: [{ patientKey: string }, { referredByKey: string }] }
  | { OR: [{ patientKey: string }, { userId: string }] };

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

/** Web booking: the phone of the visit, and also the account of a signed-in customer (a guest has no account to count). */
export function webVisitScope(patientKey: string, userId: string | null): VisitScope {
  return userId ? { OR: [{ patientKey }, { userId }] } : { patientKey };
}

/**
 * The answer the bot tools get when the limit is reached. The message is for the agent, who says it with its own
 * words: it never names a provider or one kind of business. With no chat to hand over, it must not promise a person.
 */
export function visitLimitBody(handedOff: boolean, max: number = MAX_ACTIVE_FUTURE_VISITS) {
  return {
    success: false as const,
    error: "visit_limit_reached" as const,
    max,
    handedOff,
    message: handedOff
      ? `No agendes esta cita ni ofrezcas otro horario: el cliente ya tiene ${max} citas activas. Dile al cliente, con tus palabras, que una persona del equipo lo atendera en esta conversacion.`
      : `No agendes esta cita ni ofrezcas otro horario: el cliente ya tiene ${max} citas activas. No prometas que una persona lo atendera; explica que para agendar otra debe comunicarse con el negocio.`,
  };
}
