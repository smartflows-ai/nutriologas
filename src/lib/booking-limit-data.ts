// src/lib/booking-limit-data.ts
// The count behind the daily visit limit (ticket #141). Every query is limited by tenantId, skips deleted visits
// and counts only active ones. The rules live in booking-limit.ts.
import { prisma } from "@/lib/db";
import { ACTIVE_VISIT_STATUSES, dayRangeOf, limitDecision, visitScopes, type LimitDecision, type VisitScope } from "@/lib/booking-limit";
import type { BotTenant } from "@/lib/bot";
import { raiseHelpForContact } from "@/lib/help-handler";

export interface DailyLimitInput {
  tenantId: string;
  /** patientKey of the person the visit is for. */
  patientKey: string;
  /** patientKey of the person writing to the bot (the same as patientKey when they book for themselves). */
  writerKey: string | null;
  /** YYYY-MM-DD of the visit, read on the business calendar. */
  dateKey: string;
  zone: string;
  /** A visit that is being moved does not count against its own new day. */
  excludeAppointmentId?: string;
}

/** Active, not deleted visits of one business in a day range that match `who`. */
function countActive(
  input: DailyLimitInput,
  range: { start: Date; end: Date },
  who: VisitScope,
): Promise<number> {
  return prisma.appointment.count({
    where: {
      tenantId: input.tenantId,
      deletedAt: null,
      status: { in: [...ACTIVE_VISIT_STATUSES] },
      appointmentDate: { gte: range.start, lt: range.end },
      ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
      ...who,
    },
  });
}

export async function checkDailyLimit(input: DailyLimitInput): Promise<LimitDecision> {
  const range = dayRangeOf(input.dateKey, input.zone);
  const scopes = visitScopes(input.patientKey, input.writerKey);
  const [patient, writer] = await Promise.all([
    scopes.patient ? countActive(input, range, scopes.patient) : Promise.resolve(0),
    scopes.writer ? countActive(input, range, scopes.writer) : Promise.resolve(0),
  ]);
  return limitDecision({ patient, writer });
}

/**
 * Hands the chat to a person after a refusal. True when the contact's chat was found and handed over; false when there
 * is no chat or the hand-off failed (the error is logged): the agent is then told not to promise a person, and the
 * refusal itself is never lost because of a database error.
 */
export async function handOffOverLimit(bot: BotTenant, customerPhone: unknown): Promise<boolean> {
  try {
    const handoff = await raiseHelpForContact(bot, { customerPhone }, "booking_limit");
    return handoff.status === "done";
  } catch (error) {
    console.error("booking_limit hand-off failed", error);
    return false;
  }
}
