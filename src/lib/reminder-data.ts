// src/lib/reminder-data.ts
// The real I/O of the reminder job: which visits to look at and what "send", "mark", "charge" and "release" do.
// Shared by the route and by local-utils/reminder-sim.ts, so a simulation runs the same code as production.
import { prisma } from "@/lib/db";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/bot";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { releaseVisit } from "@/lib/reminder-actions";
import { recordMessageCharge, reminderCostUsd } from "@/lib/credits";
import { failedSendState, sentState } from "@/lib/reminder-state";
import type { ReminderDeps, ReminderVisit } from "@/lib/reminder-run";

export const LOOKAHEAD_HOURS = 96; // covers reminders up to 72 h before a visit, plus a day of margin

export const realReminderDeps: ReminderDeps = {
  send: (visit, text) => sendWhatsAppMessage({ tenantId: visit.tenantId, to: visit.customerPhone as string, text }),
  markSent: async (id, now) => {
    await prisma.appointment.update({ where: { id }, data: sentState(now) });
  },
  recordFailure: async (visit, reason, now) => {
    try {
      await prisma.appointment.update({
        where: { id: visit.id },
        data: failedSendState(visit.reminderAttempts, reason, now),
      });
    } catch (error: unknown) {
      // The send failure is still reported in the response; only its history on the visit is lost.
      console.error("[reminders/run] could not record failed attempt", visit.id, error instanceof Error ? error.message : "error");
    }
  },
  charge: async (tenantId) => {
    await recordMessageCharge(tenantId, reminderCostUsd());
  },
  release: (visit, now) =>
    releaseVisit(
      {
        id: visit.id,
        tenantId: visit.tenantId,
        customerPhone: visit.customerPhone,
        appointmentDate: visit.appointmentDate,
        externalProvider: visit.externalProvider,
        externalEventId: visit.externalEventId,
        productName: visit.productName,
        tenantName: visit.tenant.name,
        messageLanguage: visit.tenant.messageLanguage,
        cancellationTemplate: visit.tenant.cancellationTemplate,
      },
      now,
    ),
};

/** Visits the job should look at. `appointmentId` narrows it to one visit (used by the local simulation). */
export async function loadReminderVisits(now: Date, appointmentId?: string): Promise<ReminderVisit[]> {
  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60000);
  const rows = await prisma.appointment.findMany({
    where: {
      ...(appointmentId ? { id: appointmentId } : {}),
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      appointmentDate: { gt: now, lte: horizon },
      tenant: { remindersEnabled: true },
    },
    select: {
      id: true,
      tenantId: true,
      customerPhone: true,
      appointmentDate: true,
      createdAt: true,
      reminderSentAt: true,
      reminderAttempts: true,
      customerConfirmedAt: true,
      autoReleasedAt: true,
      externalProvider: true,
      externalEventId: true,
      product: { select: { name: true } },
      tenant: {
        select: {
          name: true,
          messageLanguage: true,
          reminderLeadMinutes: true,
          confirmationRequired: true,
          confirmationDeadlineMinutes: true,
          reminderTemplate: true,
          confirmationTemplate: true,
          cancellationTemplate: true,
        },
      },
    },
    orderBy: { appointmentDate: "asc" },
  });
  return rows.map(({ product, ...visit }) => ({ ...visit, productName: product.name }));
}

