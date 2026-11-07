// src/lib/reminder-run.ts
// Decides and performs, visit by visit, what the reminder job does. I/O comes in through `deps`, so the logic
// is testable without a database or WhatsApp. One bad visit never stops the others, and every failure is reported.
import type { AppProvider } from "@prisma/client";
import { planReminder, releaseAt } from "@/lib/reminders";
import { clinicLongDate, clinicTime, customerTexts, renderTemplate, usableTemplate, withBookedBy, withMeetingLink } from "@/lib/reminder-messages";

export interface ReminderTenant {
  name: string;
  messageLanguage: string;
  reminderLeadMinutes: number;
  confirmationRequired: boolean;
  confirmationDeadlineMinutes: number;
  reminderTemplate: string | null;
  confirmationTemplate: string | null;
  cancellationTemplate: string | null;
}

export interface ReminderVisit {
  id: string;
  tenantId: string;
  customerPhone: string | null;
  customerName: string | null;
  appointmentDate: Date;
  createdAt: Date;
  reminderSentAt: Date | null;
  reminderAttempts: number;
  customerConfirmedAt: Date | null;
  autoReleasedAt: Date | null;
  externalProvider: AppProvider | null;
  externalEventId: string | null;
  productName: string;
  /** Online visits carry their video call link in the reminder. Optional: older callers have neither. */
  modality?: "IN_PERSON" | "ONLINE" | null;
  meetUrl?: string | null;
  /** Set when someone else booked the visit for this patient: the message says who. */
  referredByKey?: string | null;
  referredByName?: string | null;
  tenant: ReminderTenant;
}

export interface ReminderDeps {
  send: (visit: ReminderVisit, text: string) => Promise<{ success: boolean; reason?: string }>;
  markSent: (id: string, now: Date) => Promise<void>;
  /** Stores the failed attempt on the visit. A failure here is ignored: it must not hide the send failure. */
  recordFailure: (visit: ReminderVisit, reason: string, now: Date) => Promise<void>;
  charge: (tenantId: string) => Promise<void>;
  /** `customerNotified` is false when the cancellation text could not be delivered. */
  release: (visit: ReminderVisit, now: Date) => Promise<{ customerNotified: boolean }>;
}

export type ReminderFailureKind = "send_failed" | "exception" | "cancellation_not_sent";

export interface ReminderFailure {
  appointmentId: string;
  tenantId: string;
  kind: ReminderFailureKind;
  reason: string;
}

export interface ReminderBatchResult {
  sent: number;
  released: number;
  skipped: number;
  failed: number;
  failures: ReminderFailure[];
  actions: object[];
}

type Outcome =
  | { type: "sent" }
  | { type: "released"; failure?: ReminderFailure }
  | { type: "skipped" }
  | { type: "none" }
  | { type: "failed"; failure: ReminderFailure }
  | { type: "planned"; action: object };

function failure(visit: ReminderVisit, kind: ReminderFailureKind, reason: string): ReminderFailure {
  return { appointmentId: visit.id, tenantId: visit.tenantId, kind, reason };
}

function reminderText(visit: ReminderVisit, requestConfirmation: boolean, releaseInstant: Date | null): string {
  const t = visit.tenant;
  const texts = customerTexts(t.messageLanguage);
  const values = {
    servicio: visit.productName,
    fecha: clinicLongDate(visit.appointmentDate, t.messageLanguage),
    hora: clinicTime(visit.appointmentDate, t.messageLanguage),
    negocio: t.name,
    nombre: visit.customerName,
  };
  const warn = (kind: string) => (problem: string) =>
    console.warn(`[reminders] stored ${kind} text ignored (${problem}) for tenant ${visit.tenantId}; default used`);
  const tail = requestConfirmation
    ? renderTemplate(usableTemplate(t.confirmationTemplate, "confirmation", texts.confirmationTemplate, warn("confirmation")), {
        ...values,
        hora_limite: clinicTime(releaseInstant as Date, t.messageLanguage),
      })
    : texts.plainFooter;
  const body = `${renderTemplate(usableTemplate(t.reminderTemplate, "reminder", texts.reminderTemplate, warn("reminder")), values)}\n\n${tail}`;
  return withBookedBy(withMeetingLink(body, visit, t.messageLanguage), visit, t.messageLanguage);
}

async function processVisit(visit: ReminderVisit, now: Date, deps: ReminderDeps, dryRun: boolean): Promise<Outcome> {
  const t = visit.tenant;
  const plan = planReminder({
    apptStart: visit.appointmentDate,
    createdAt: visit.createdAt,
    leadMinutes: t.reminderLeadMinutes,
    deadlineMinutes: t.confirmationDeadlineMinutes,
    confirmationRequired: t.confirmationRequired,
  });
  const deadline = releaseAt(visit.appointmentDate, t.confirmationDeadlineMinutes);
  // Confirmed by the customer (SI), the Confirmations tab or the Confirmar button in Citas: all three set
  // customerConfirmedAt. The status is not used: the bot creates its bookings CONFIRMED before anyone confirms.
  const isConfirmed = visit.customerConfirmedAt !== null;
  // A confirmed visit still gets its reminder, but never the request to reply.
  const asksToConfirm = plan.requestConfirmation && !isConfirmed;

  // Release: a confirmation was requested, the deadline passed, and nobody confirmed.
  const mustRelease = visit.reminderSentAt && !visit.autoReleasedAt && asksToConfirm && now >= deadline;
  if (mustRelease) {
    if (dryRun) return { type: "planned", action: { action: "release", appointmentId: visit.id, deadline: deadline.toISOString() } };
    const { customerNotified } = await deps.release(visit, now);
    return customerNotified
      ? { type: "released" }
      : { type: "released", failure: failure(visit, "cancellation_not_sent", "La cita se libero pero el aviso de cancelacion no se entrego") };
  }

  // Reminder: due, not sent yet, and the visit has a reachable phone.
  const due = now >= plan.sendAt;
  if (visit.reminderSentAt || !due || !(plan.requestConfirmation || plan.sendPlain)) return { type: "none" };
  if (!visit.customerPhone) return { type: "skipped" };

  if (dryRun) {
    return { type: "planned", action: { action: "remind", appointmentId: visit.id, confirmation: asksToConfirm, sendAt: plan.sendAt.toISOString() } };
  }

  const sent = await deps.send(visit, reminderText(visit, asksToConfirm, asksToConfirm ? plan.releaseAt : null));
  if (!sent.success) {
    // Nothing is marked or charged, so the next run retries.
    const reason = sent.reason ?? "Envio rechazado";
    await deps.recordFailure(visit, reason, now).catch(() => undefined);
    return { type: "failed", failure: failure(visit, "send_failed", reason) };
  }
  await deps.markSent(visit.id, now);
  await deps.charge(visit.tenantId);
  return { type: "sent" };
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado";
}

/** Processes every visit; an exception on one is recorded and the loop continues with the next. */
export async function runReminderBatch(
  visits: readonly ReminderVisit[],
  now: Date,
  deps: ReminderDeps,
  options: { dryRun: boolean },
): Promise<ReminderBatchResult> {
  const outcomes: Outcome[] = [];
  for (const visit of visits) {
    try {
      outcomes.push(await processVisit(visit, now, deps, options.dryRun));
    } catch (error: unknown) {
      outcomes.push({ type: "failed", failure: failure(visit, "exception", errorReason(error)) });
    }
  }

  return {
    sent: outcomes.filter((o) => o.type === "sent").length,
    released: outcomes.filter((o) => o.type === "released").length,
    skipped: outcomes.filter((o) => o.type === "skipped").length,
    failed: outcomes.filter((o) => o.type === "failed").length,
    failures: outcomes.flatMap((o) => (o.type === "failed" || o.type === "released" ? (o.failure ? [o.failure] : []) : [])),
    actions: outcomes.flatMap((o) => (o.type === "planned" ? [o.action] : [])),
  };
}

/**
 * HTTP status for the run. n8n marks a run as success on any 2xx, so a run where every attempted send failed
 * answers 502 to show up as an error there. A partial failure stays 200 (the failures are in the body).
 */
export function reminderRunStatus(result: ReminderBatchResult, dryRun: boolean): number {
  return !dryRun && result.sent === 0 && result.failed > 0 ? 502 : 200;
}
