// src/lib/booking-limit-data.ts
// The count behind the visit limit (ticket #141). Every query is limited by tenantId, skips deleted visits and counts
// only active visits that have not happened yet. The rules live in booking-limit.ts.
import { prisma } from "@/lib/db";
import {
  ACTIVE_VISIT_STATUSES,
  futureRange,
  limitDecision,
  visitScopes,
  webVisitScope,
  type LimitDecision,
  type VisitScope,
} from "@/lib/booking-limit";
import type { BotTenant } from "@/lib/bot";
import { raiseHelpForContact } from "@/lib/help-handler";

export interface VisitLimitInput {
  tenantId: string;
  /** patientKey of the person the visit is for. */
  patientKey: string;
  /** patientKey of the person writing to the bot (the same as patientKey when they book for themselves). */
  writerKey: string | null;
  /** The instant the visits are counted from: only later ones count. */
  now: Date;
}

/** Active, not deleted, future visits of one business that match `who`. */
function countActive(tenantId: string, now: Date, who: VisitScope): Promise<number> {
  return prisma.appointment.count({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: [...ACTIVE_VISIT_STATUSES] },
      appointmentDate: futureRange(now),
      ...who,
    },
  });
}

/** Bot booking: counted by the patient of the visit and by the person writing. */
export async function checkVisitLimit(input: VisitLimitInput): Promise<LimitDecision> {
  const scopes = visitScopes(input.patientKey, input.writerKey);
  const [patient, writer] = await Promise.all([
    scopes.patient ? countActive(input.tenantId, input.now, scopes.patient) : Promise.resolve(0),
    scopes.writer ? countActive(input.tenantId, input.now, scopes.writer) : Promise.resolve(0),
  ]);
  return limitDecision({ patient, writer });
}

/** Public web booking: counted by the phone of the visit and, with a customer session, by their account. */
export async function checkWebVisitLimit(input: { tenantId: string; patientKey: string; userId: string | null; now: Date }): Promise<LimitDecision> {
  const count = await countActive(input.tenantId, input.now, webVisitScope(input.patientKey, input.userId));
  return limitDecision({ patient: count, writer: 0 });
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
