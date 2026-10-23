// src/app/api/internal/reminders/run/route.ts
// POST: Sends due appointment reminders and releases visits nobody confirmed.
// Called every 15 min by the reminders workflow. No LLM. Body { dryRun?: boolean } lists the work without acting.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isInternalKeyValid, ACTIVE_APPOINTMENT_STATUSES } from "@/lib/bot";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { releaseVisit } from "@/lib/reminder-actions";
import { planReminder, releaseAt, type ReminderMode } from "@/lib/reminders";
import { recordMessageCharge, reminderCostUsd } from "@/lib/credits";
import {
  clinicLongDate,
  clinicTime,
  customerTexts,
  renderTemplate,
} from "@/lib/reminder-messages";

const LOOKAHEAD_HOURS = 72; // covers the day-before reminder of visits up to ~2 days away

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;
  const now = new Date();
  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      appointmentDate: { gt: now, lte: horizon },
      tenant: { remindersEnabled: true },
    },
    select: {
      id: true,
      tenantId: true,
      customerPhone: true,
      appointmentDate: true,
      durationMinutes: true,
      createdAt: true,
      reminderSentAt: true,
      customerConfirmedAt: true,
      autoReleasedAt: true,
      externalProvider: true,
      externalEventId: true,
      product: { select: { name: true } },
      tenant: {
        select: {
          name: true,
          messageLanguage: true,
          reminderMode: true,
          reminderSendTime: true,
          confirmationRequired: true,
          confirmationDeadlineHours: true,
          reminderTemplate: true,
          confirmationTemplate: true,
          cancellationTemplate: true,
        },
      },
    },
    orderBy: { appointmentDate: "asc" },
  });

  const result = { checked: appointments.length, sent: 0, released: 0, skipped: 0, failed: 0, dryRun, actions: [] as object[] };

  for (const appt of appointments) {
    const t = appt.tenant;
    const plan = planReminder({
      apptStart: appt.appointmentDate,
      createdAt: appt.createdAt,
      mode: t.reminderMode as ReminderMode,
      sendTime: t.reminderSendTime,
      confirmationRequired: t.confirmationRequired,
      deadlineHours: t.confirmationDeadlineHours,
    });
    const deadline = releaseAt(appt.appointmentDate, t.confirmationDeadlineHours);
    const hasPhone = Boolean(appt.customerPhone);

    // Release: a confirmation was requested, the deadline passed, and the customer did not answer.
    if (
      appt.reminderSentAt &&
      !appt.customerConfirmedAt &&
      !appt.autoReleasedAt &&
      plan.requestConfirmation &&
      now.getTime() >= deadline.getTime()
    ) {
      if (dryRun) {
        result.actions.push({ action: "release", appointmentId: appt.id, deadline: deadline.toISOString() });
        continue;
      }
      await releaseVisit({
        id: appt.id,
        tenantId: appt.tenantId,
        customerPhone: appt.customerPhone,
        appointmentDate: appt.appointmentDate,
        externalProvider: appt.externalProvider,
        externalEventId: appt.externalEventId,
        productName: appt.product.name,
        tenantName: t.name,
        messageLanguage: t.messageLanguage,
        cancellationTemplate: t.cancellationTemplate,
      }, now);
      result.released++;
      continue;
    }

    // Reminder: due, not sent yet, and the visit still has a reachable phone.
    const due = now.getTime() >= plan.sendAt.getTime();
    if (!appt.reminderSentAt && due && (plan.requestConfirmation || plan.sendPlain)) {
      if (!hasPhone) {
        result.skipped++;
        continue;
      }

      const texts = customerTexts(t.messageLanguage);
      const values = {
        servicio: appt.product.name,
        fecha: clinicLongDate(appt.appointmentDate, t.messageLanguage),
        hora: clinicTime(appt.appointmentDate, t.messageLanguage),
        negocio: t.name,
      };
      const confirmationPart = plan.requestConfirmation
        ? `\n\n${renderTemplate(t.confirmationTemplate ?? texts.confirmationTemplate, {
            ...values,
            hora_limite: clinicTime(plan.releaseAt!, t.messageLanguage),
          })}`
        : `\n\n${texts.plainFooter}`;
      const text = renderTemplate(t.reminderTemplate ?? texts.reminderTemplate, values) + confirmationPart;

      if (dryRun) {
        result.actions.push({ action: "remind", appointmentId: appt.id, confirmation: plan.requestConfirmation, sendAt: plan.sendAt.toISOString() });
        continue;
      }

      const sent = await sendWhatsAppMessage({ tenantId: appt.tenantId, to: appt.customerPhone!, text });
      if (!sent.success) {
        // Nothing is marked or charged, so the next run retries.
        console.error("[reminders/run] Send failed:", appt.id, sent.reason);
        result.failed++;
        continue;
      }

      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: now } });
      await recordMessageCharge(appt.tenantId, reminderCostUsd());
      result.sent++;
    }
  }

  return Response.json({ success: true, ...result });
}
