// src/lib/reminder-run.ts
// Decides and performs, visit by visit, what the reminder job does. I/O comes in through `deps`, so the logic
// is testable without a database or WhatsApp. One bad visit never stops the others, and every failure is reported.
import type { AppProvider } from "@prisma/client";
import { planReminder, releaseAt } from "@/lib/reminders";
import { hasLocationTag, hasVisitDetailTags } from "@/lib/reminder-template-rules";
import { timeZoneLabel } from "@/lib/time-zones";
import { clinicTimeOf } from "@/lib/clinic-time";
import { mayStartMessage, type MessagingPolicyMode } from "@/lib/wa-consent";
import {
  DEFAULT_QUIET_END_MIN,
  DEFAULT_QUIET_START_MIN,
  MAX_SENDS_PER_INSTANCE_PER_RUN,
  minutesOfDay,
  shouldHoldForQuietHours,
  underSendCap,
} from "@/lib/wa-pacing";
import { clinicLongDate, clinicTime, customerTexts, placeLine, placeText, renderTemplate, usableTemplate, withBookedBy, withPlaceAfterDetails, withLocation, withMeetingLink } from "@/lib/reminder-messages";

export interface ReminderTenant {
  name: string;
  ownerName?: string | null;
  messageLanguage: string;
  /** The business time zone (IANA, ticket #111): dates and times in the messages are on its clock. */
  timeZone: string;
  reminderLeadMinutes: number;
  confirmationRequired: boolean;
  confirmationDeadlineMinutes: number;
  reminderTemplate: string | null;
  confirmationTemplate: string | null;
  cancellationTemplate: string | null;
  /** Address plus directions link (`locationTextForBot`); empty or missing when the business has no physical place. */
  locationText?: string | null;
  /** Ban prevention: strict-consent gate and quiet hours. Optional so older callers/tests keep working. */
  messagingPolicyMode?: MessagingPolicyMode | null;
  messagingEnforcedAt?: Date | null;
  quietHoursStartMin?: number | null;
  quietHoursEndMin?: number | null;
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
  /** Ban prevention: the customer opted out, and the consent captured for this visit (if any). */
  optedOutAt?: Date | null;
  whatsappConsentAt?: Date | null;
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
  /** Blocked by the strict-consent gate in ENFORCE mode (no reminder sent). */
  blocked: number;
  /** Would have been blocked by consent, but SHADOW mode let it through (for measuring before enforcing). */
  shadowWouldBlock: number;
  /** Held for quiet hours or the per-instance cap; retried on a later run. */
  deferred: number;
  failures: ReminderFailure[];
  actions: object[];
}

type Outcome =
  | { type: "sent"; shadowWouldBlock?: boolean }
  | { type: "released"; failure?: ReminderFailure }
  | { type: "skipped" }
  | { type: "none" }
  | { type: "blocked"; shadow: boolean }
  | { type: "deferred" }
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
    fecha: clinicLongDate(visit.appointmentDate, t.messageLanguage, t.timeZone),
    hora: clinicTime(visit.appointmentDate, t.messageLanguage, t.timeZone),
    zona: timeZoneLabel(t.timeZone, t.messageLanguage),
    negocio: t.name,
    responsable: t.ownerName,
    nombre: visit.customerName,
    ubicacion: placeText(visit, t.locationText),
  };
  const warn = (kind: string) => (problem: string) =>
    console.warn(`[reminders] stored ${kind} text ignored (${problem}) for tenant ${visit.tenantId}; default used`);
  const confirmationSource = requestConfirmation
    ? usableTemplate(t.confirmationTemplate, "confirmation", texts.confirmationTemplate, warn("confirmation"))
    : null;
  // A confirmation text that already names the visit (service, date or time) is the whole message: sending the
  // reminder text above it repeats the same greeting and details. The default confirmation text is only the
  // short request, so it is still added under the reminder.
  if (confirmationSource !== null && hasVisitDetailTags(confirmationSource)) {
    const body = renderTemplate(confirmationSource, { ...values, hora_limite: clinicTime(releaseInstant as Date, t.messageLanguage, t.timeZone) });
    const line = hasLocationTag(confirmationSource) ? null : placeLine(visit, t.locationText, t.messageLanguage);
    return withBookedBy(line ? withPlaceAfterDetails(confirmationSource, body, line) : body, visit, t.messageLanguage);
  }
  const reminderSource = usableTemplate(t.reminderTemplate, "reminder", texts.reminderTemplate, warn("reminder"));
  // The business's own reminder text is sent as written: the default footer is only added under the default text.
  const reminderIsCustom = Boolean(t.reminderTemplate?.trim()) && reminderSource !== texts.reminderTemplate;
  const tail =
    confirmationSource !== null
      ? renderTemplate(confirmationSource, { ...values, hora_limite: clinicTime(releaseInstant as Date, t.messageLanguage, t.timeZone) })
      : reminderIsCustom
        ? null
        : texts.plainFooter;
  const head = renderTemplate(reminderSource, values);
  // A text that places the address or video link itself (location tag) is left alone; otherwise it is added right
  // after the visit details, and the request to reply stays last.
  const placedByBusiness = hasLocationTag(reminderSource) || (confirmationSource !== null && hasLocationTag(confirmationSource));
  const headWithPlace = placedByBusiness
    ? head
    : withLocation(withMeetingLink(head, visit, t.messageLanguage), visit, t.locationText, t.messageLanguage);
  return withBookedBy(tail === null ? headWithPlace : `${headWithPlace}\n\n${tail}`, visit, t.messageLanguage);
}

async function processVisit(visit: ReminderVisit, now: Date, deps: ReminderDeps, dryRun: boolean, canSend: boolean): Promise<Outcome> {
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

  // Ban-prevention gate: strict consent and opt-out. A blocked visit sends nothing and (since reminderSentAt
  // stays null) is never released — it counts as confirmed.
  const mode: MessagingPolicyMode = t.messagingPolicyMode === "ENFORCE" ? "ENFORCE" : "SHADOW";
  const consent = mayStartMessage({
    optedOutAt: visit.optedOutAt ?? null,
    consentAt: visit.whatsappConsentAt ?? null,
    createdAt: visit.createdAt,
    enforcedAt: t.messagingEnforcedAt ?? null,
    mode,
  });
  if (!consent.allowed) return { type: "blocked", shadow: consent.shadow };

  // Quiet hours (business local clock): hold a night-time reminder for the morning when the visit allows it.
  const localMin = minutesOfDay(clinicTimeOf(now, t.timeZone));
  const minutesUntilAppt = Math.round((visit.appointmentDate.getTime() - now.getTime()) / 60000);
  if (
    shouldHoldForQuietHours({
      localMin,
      minutesUntilAppt,
      minutesUntilDeadline: asksToConfirm ? Math.round((deadline.getTime() - now.getTime()) / 60000) : null,
      quietStartMin: t.quietHoursStartMin ?? DEFAULT_QUIET_START_MIN,
      quietEndMin: t.quietHoursEndMin ?? DEFAULT_QUIET_END_MIN,
    })
  ) {
    return { type: "deferred" };
  }

  if (dryRun) {
    return { type: "planned", action: { action: "remind", appointmentId: visit.id, confirmation: asksToConfirm, sendAt: plan.sendAt.toISOString() } };
  }

  // Per-instance cap: spread sends across runs so the number never sends a burst.
  if (!canSend) return { type: "deferred" };

  const sent = await deps.send(visit, reminderText(visit, asksToConfirm, asksToConfirm ? plan.releaseAt : null));
  if (!sent.success) {
    // Nothing is marked or charged, so the next run retries.
    const reason = sent.reason ?? "Envio rechazado";
    await deps.recordFailure(visit, reason, now).catch(() => undefined);
    return { type: "failed", failure: failure(visit, "send_failed", reason) };
  }
  await deps.markSent(visit.id, now);
  await deps.charge(visit.tenantId);
  return { type: "sent", shadowWouldBlock: consent.shadow };
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
  // Per-instance cap: a tenant (one WhatsApp number) sends at most MAX_SENDS_PER_INSTANCE_PER_RUN this run.
  const sentPerTenant = new Map<string, number>();
  for (const visit of visits) {
    try {
      const used = sentPerTenant.get(visit.tenantId) ?? 0;
      const canSend = options.dryRun || underSendCap(used, MAX_SENDS_PER_INSTANCE_PER_RUN);
      const outcome = await processVisit(visit, now, deps, options.dryRun, canSend);
      if (outcome.type === "sent" || outcome.type === "released") sentPerTenant.set(visit.tenantId, used + 1);
      outcomes.push(outcome);
    } catch (error: unknown) {
      outcomes.push({ type: "failed", failure: failure(visit, "exception", errorReason(error)) });
    }
  }

  return {
    sent: outcomes.filter((o) => o.type === "sent").length,
    released: outcomes.filter((o) => o.type === "released").length,
    skipped: outcomes.filter((o) => o.type === "skipped").length,
    failed: outcomes.filter((o) => o.type === "failed").length,
    blocked: outcomes.filter((o) => o.type === "blocked").length,
    shadowWouldBlock: outcomes.filter((o) => o.type === "sent" && o.shadowWouldBlock).length,
    deferred: outcomes.filter((o) => o.type === "deferred").length,
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
