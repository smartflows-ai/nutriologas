// src/lib/reminder-actions.ts
// The two actions a visit can get after a reminder: confirmed, or released for lack of confirmation.
// Used by the reminder job and by the owner's confirmations list, so both behave the same way.
import type { AppProvider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { cancelAppointment } from "@/lib/appointments-service";
import { customerMeetUrl } from "@/lib/short-links";
import { timeZoneLabel } from "@/lib/time-zones";
import { clinicLongDate, clinicTime, customerTexts, renderTemplate, withLocation, withMeetingLink } from "@/lib/reminder-messages";
import { cancelNoticeText } from "@/lib/cancel-notice";
import { locationTextForBot } from "@/lib/location";

/** The tenant fields the place line needs (ticket #74); add them to any tenant select that builds a confirmation. */
export const TENANT_PLACE_SELECT = {
  slug: true,
  customDomain: true,
  messageLanguage: true,
  hasPhysicalLocation: true,
  address: true,
  placeId: true,
  latitude: true,
  longitude: true,
} as const;

/** Address plus the short directions link, or "" when the business has no physical place. */
export function placeTextOf(tenant: {
  slug: string;
  customDomain: string | null;
  messageLanguage: string;
  hasPhysicalLocation: boolean;
  address: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
}): string {
  return locationTextForBot(tenant);
}

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
  /** Consent captured for this visit (ban prevention). Missing = no consent recorded. */
  whatsappConsentAt?: Date | null;
  messageLanguage: string;
  /** The business time zone (IANA, ticket #111). */
  timeZone: string;
  cancellationTemplate: string | null;
  /** Online visits carry their video call link in the confirmation. Optional: older callers have neither. */
  modality?: "IN_PERSON" | "ONLINE" | null;
  meetUrl?: string | null;
  /** Address plus directions link (placeTextOf); empty or missing when the business has no physical place (#74). */
  locationText?: string | null;
}

function visitValues(visit: VisitForAction) {
  return {
    servicio: visit.productName,
    fecha: clinicLongDate(visit.appointmentDate, visit.messageLanguage, visit.timeZone),
    hora: clinicTime(visit.appointmentDate, visit.messageLanguage, visit.timeZone),
    zona: timeZoneLabel(visit.timeZone, visit.messageLanguage),
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
    // The release gate already ran for this visit (a visit without consent is never released in ENFORCE).
    purpose: "TRANSACTIONAL",
    consent: "YES",
    idempotencyKey: `cancel:${visit.id}`,
    text: cancelNoticeText("auto_release", visit.cancellationTemplate, visitValues(visit), visit.messageLanguage, (problem) =>
      console.warn(`[reminders] stored cancellation text ignored (${problem}) for tenant ${visit.tenantId}; default used`),
    ) as string,
  });
  return { customerNotified: sent.success };
}

/**
 * The message a customer gets when the business confirms their visit: Mexico time, the business language, the
 * video link of an online visit. Shared by the Confirmaciones tab and the Confirmar button in Citas (ticket #103).
 */
export function ownerConfirmationText(visit: VisitForAction): string {
  // Online: the video link; in person: the address with its directions link (ticket #74). Never both.
  return withLocation(
    withMeetingLink(renderTemplate(customerTexts(visit.messageLanguage).ownerConfirmedText, visitValues(visit)), visit, visit.messageLanguage),
    visit,
    visit.locationText,
    visit.messageLanguage,
  );
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
      text: ownerConfirmationText(visit),
      purpose: "TRANSACTIONAL",
      consent: visit.whatsappConsentAt ? "YES" : "NO",
    });
  }
}

/** Loads what the patient's notice needs for a visit of this business. Null when the visit is gone. */
async function loadNoticeVisit(visitId: string, tenantId: string): Promise<VisitForAction | null> {
  const row = await prisma.appointment.findFirst({
    where: { id: visitId, tenantId, deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      customerPhone: true,
      customerName: true,
      appointmentDate: true,
      externalProvider: true,
      externalEventId: true,
      whatsappConsentAt: true,
      modality: true,
      meetUrl: true,
      meetShortCode: true,
      product: { select: { name: true } },
      tenant: { select: { ...TENANT_PLACE_SELECT, name: true, ownerName: true, timeZone: true, cancellationTemplate: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerPhone: row.customerPhone,
    customerName: row.customerName,
    appointmentDate: row.appointmentDate,
    externalProvider: row.externalProvider,
    externalEventId: row.externalEventId,
    productName: row.product?.name ?? "",
    tenantName: row.tenant.name,
    ownerName: row.tenant.ownerName,
    whatsappConsentAt: row.whatsappConsentAt,
    messageLanguage: row.tenant.messageLanguage,
    timeZone: row.tenant.timeZone,
    cancellationTemplate: row.tenant.cancellationTemplate,
    modality: row.modality,
    meetUrl: row.meetUrl ? customerMeetUrl({ meetUrl: row.meetUrl, meetShortCode: row.meetShortCode }, row.tenant) || null : null,
    locationText: placeTextOf(row.tenant),
  };
}

/**
 * Hole 1: a visit was cancelled from the panel (by the business, or by the patient in Mis citas, same route). The patient gets the neutral cancellation text (ticket #161), never the release text.
 * It goes through the messaging policy (consent from the visit; opt-out always blocks). Returns whether it was sent.
 */
export async function notifyCancelledFromPanel(visitId: string, tenantId: string): Promise<boolean> {
  const visit = await loadNoticeVisit(visitId, tenantId);
  if (!visit?.customerPhone) return false;
  const sent = await sendWhatsAppMessage({
    tenantId,
    to: visit.customerPhone,
    // Neutral text (ticket #161): the visit was not released for lack of confirmation, and it does not say who cancelled.
    text: cancelNoticeText("panel", visit.cancellationTemplate, visitValues(visit), visit.messageLanguage) as string,
    purpose: "TRANSACTIONAL",
    consent: visit.whatsappConsentAt ? "YES" : "NO",
    idempotencyKey: `cancel:${visitId}`,
  });
  return sent.success;
}

/**
 * Hole 1: the business moved a visit to another time from the panel. The patient gets the visit's new date and time,
 * in the same text as the confirmation. The key includes the new time, so each move is its own message.
 */
export async function notifyMovedFromPanel(visitId: string, tenantId: string): Promise<boolean> {
  const visit = await loadNoticeVisit(visitId, tenantId);
  if (!visit?.customerPhone) return false;
  const sent = await sendWhatsAppMessage({
    tenantId,
    to: visit.customerPhone,
    text: ownerConfirmationText(visit),
    purpose: "TRANSACTIONAL",
    consent: visit.whatsappConsentAt ? "YES" : "NO",
    idempotencyKey: `move:${visitId}:${visit.appointmentDate.toISOString()}`,
  });
  return sent.success;
}
