// src/lib/reminder-actions.ts
// The two actions a visit can get after a reminder: confirmed, or released for lack of confirmation.
// Used by the reminder job and by the owner's confirmations list, so both behave the same way.
import type { AppProvider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { cancelAppointment } from "@/lib/appointments-service";
import { cancellationText, clinicLongDate, clinicTime, customerTexts, renderTemplate, withMeetingLink } from "@/lib/reminder-messages";

export interface VisitForAction {
  id: string;
  tenantId: string;
  customerPhone: string | null;
  customerName: string | null;
  appointmentDate: Date;
  externalProvider: AppProvider | null;
  externalEventId: string | null;
  productName: string;
  tenantName: string;
  ownerName?: string | null;
  messageLanguage: string;
  cancellationTemplate: string | null;
  /** Online visits carry their video call link in the confirmation. Optional: older callers have neither. */
  modality?: "IN_PERSON" | "ONLINE" | null;
  meetUrl?: string | null;
}

function visitValues(visit: VisitForAction) {
  return {
    servicio: visit.productName,
    fecha: clinicLongDate(visit.appointmentDate, visit.messageLanguage),
    hora: clinicTime(visit.appointmentDate, visit.messageLanguage),
    negocio: visit.tenantName,
    responsable: visit.ownerName,
    nombre: visit.customerName,
  };
}

/** Cancels the visit for lack of confirmation, frees the slot and tells the customer. */
export async function releaseVisit(
  visit: VisitForAction,
  now: Date = new Date(),
): Promise<{ customerNotified: boolean }> {
  await cancelAppointment(
    visit.tenantId,
    { id: visit.id, externalProvider: visit.externalProvider, externalEventId: visit.externalEventId },
    "CANCELLED",
  );
  await prisma.appointment.update({ where: { id: visit.id }, data: { autoReleasedAt: now } });

  // Without a phone there is nothing to deliver, so it does not count as an undelivered text.
  if (!visit.customerPhone) return { customerNotified: true };

  const sent = await sendWhatsAppMessage({
    tenantId: visit.tenantId,
    to: visit.customerPhone,
    text: cancellationText(visit.cancellationTemplate, visitValues(visit), visit.messageLanguage, (problem) =>
      console.warn(`[reminders] stored cancellation text ignored (${problem}) for tenant ${visit.tenantId}; default used`),
    ),
  });
  return { customerNotified: sent.success };
}

/** Marks the visit confirmed by the customer (or by the owner on their behalf) and tells the customer. */
export async function confirmVisit(visit: VisitForAction, now: Date = new Date()): Promise<void> {
  await prisma.appointment.update({
    where: { id: visit.id },
    data: { customerConfirmedAt: now, status: "CONFIRMED" },
  });

  if (visit.customerPhone) {
    await sendWhatsAppMessage({
      tenantId: visit.tenantId,
      to: visit.customerPhone,
      text: withMeetingLink(
        renderTemplate(customerTexts(visit.messageLanguage).ownerConfirmedText, visitValues(visit)),
        visit,
        visit.messageLanguage,
      ),
    });
  }
}
