// src/lib/reminder-actions.ts
// The two actions a visit can get after a reminder: confirmed, or released for lack of confirmation.
// Used by the reminder job and by the owner's confirmations list, so both behave the same way.
import type { AppProvider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { cancelAppointment } from "@/lib/appointments-service";
import { clinicLongDate, clinicTime, customerTexts, renderTemplate } from "@/lib/reminder-messages";

export interface VisitForAction {
  id: string;
  tenantId: string;
  customerPhone: string | null;
  appointmentDate: Date;
  externalProvider: AppProvider | null;
  externalEventId: string | null;
  productName: string;
  tenantName: string;
  messageLanguage: string;
  cancellationTemplate: string | null;
}

function visitValues(visit: VisitForAction) {
  return {
    servicio: visit.productName,
    fecha: clinicLongDate(visit.appointmentDate, visit.messageLanguage),
    hora: clinicTime(visit.appointmentDate, visit.messageLanguage),
    negocio: visit.tenantName,
  };
}

/** Cancels the visit for lack of confirmation, frees the slot and tells the customer. */
export async function releaseVisit(visit: VisitForAction, now: Date = new Date()): Promise<void> {
  await cancelAppointment(
    visit.tenantId,
    { id: visit.id, externalProvider: visit.externalProvider, externalEventId: visit.externalEventId },
    "CANCELLED",
  );
  await prisma.appointment.update({ where: { id: visit.id }, data: { autoReleasedAt: now } });

  if (visit.customerPhone) {
    await sendWhatsAppMessage({
      tenantId: visit.tenantId,
      to: visit.customerPhone,
      text: renderTemplate(
        visit.cancellationTemplate ?? customerTexts(visit.messageLanguage).cancellationTemplate,
        visitValues(visit),
      ),
    });
  }
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
      text: renderTemplate(customerTexts(visit.messageLanguage).ownerConfirmedText, visitValues(visit)),
    });
  }
}
