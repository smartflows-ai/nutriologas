// src/lib/reminder-data.ts
// The real I/O of the reminder job: which visits to look at and what "send", "mark", "charge" and "release" do.
// Shared by the route and by local-utils/reminder-sim.ts, so a simulation runs the same code as production.
import { prisma } from "@/lib/db";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/bot";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { patientKeyOf } from "@/lib/patient-key";
import type { MessagingPolicyMode } from "@/lib/wa-consent";
import { releaseVisit } from "@/lib/reminder-actions";
import { locationTextForBot } from "@/lib/location";
import { recordMessageCharge, reminderCostUsd } from "@/lib/credits";
import { failedSendState, sentState } from "@/lib/reminder-state";
import type { ReminderDeps, ReminderVisit } from "@/lib/reminder-run";
import { customerMeetUrl } from "@/lib/short-links";
import { usableTimeZone } from "@/lib/tenant-time-zone";

export const LOOKAHEAD_HOURS = 96; // covers reminders up to 72 h before a visit, plus a day of margin

export const realReminderDeps: ReminderDeps = {
  // The strict-consent and quiet-hours gate ran in reminder-run before this call, so consent is passed as given.
  send: (visit, text) =>
    sendWhatsAppMessage({
      tenantId: visit.tenantId,
      to: visit.customerPhone as string,
      text,
      purpose: "TRANSACTIONAL",
      consent: "YES",
      idempotencyKey: `reminder:${visit.id}`,
    }),
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
        customerName: visit.customerName,
        whatsappConsentAt: visit.whatsappConsentAt,
        appointmentDate: visit.appointmentDate,
        externalProvider: visit.externalProvider,
        externalEventId: visit.externalEventId,
        productName: visit.productName,
        tenantName: visit.tenant.name,
        ownerName: visit.tenant.ownerName,
        messageLanguage: visit.tenant.messageLanguage,
        timeZone: visit.tenant.timeZone,
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
      deletedAt: null,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      appointmentDate: { gt: now, lte: horizon },
      tenant: { remindersEnabled: true },
    },
    select: {
      id: true,
      tenantId: true,
      customerPhone: true,
      customerName: true,
      appointmentDate: true,
      createdAt: true,
      reminderSentAt: true,
      reminderAttempts: true,
      customerConfirmedAt: true,
      autoReleasedAt: true,
      externalProvider: true,
      externalEventId: true,
      modality: true,
      meetUrl: true,
      meetShortCode: true,
      referredByKey: true,
      referredByName: true,
      patientKey: true,
      whatsappConsentAt: true,
      product: { select: { name: true } },
      tenant: {
        select: {
          name: true,
          ownerName: true,
          messageLanguage: true,
          timeZone: true,
          reminderLeadMinutes: true,
          confirmationRequired: true,
          confirmationDeadlineMinutes: true,
          reminderTemplate: true,
          confirmationTemplate: true,
          cancellationTemplate: true,
          messagingPolicyMode: true,
          messagingEnforcedAt: true,
          quietHoursStartMin: true,
          quietHoursEndMin: true,
          hasPhysicalLocation: true,
          address: true,
          placeId: true,
          latitude: true,
          longitude: true,
          slug: true,
          customDomain: true,
        },
      },
    },
    orderBy: { appointmentDate: "asc" },
  });

  // Opt-out lookup (ban prevention): a customer who said "stop" is on their chat, keyed by remoteJid. Match it to
  // the visit by normalized patient key. Only opted-out chats are loaded, so this is a small set.
  const tenantIds = Array.from(new Set(rows.map((r) => r.tenantId)));
  const optedOutChats = tenantIds.length
    ? await prisma.whatsAppChat.findMany({
        where: { tenantId: { in: tenantIds }, optedOutAt: { not: null } },
        select: { tenantId: true, remoteJid: true, optedOutAt: true },
      })
    : [];
  const optOutByKey = new Map<string, Date>();
  for (const chat of optedOutChats) {
    const key = patientKeyOf(chat.remoteJid.split("@")[0]);
    if (key && chat.optedOutAt) optOutByKey.set(`${chat.tenantId}:${key}`, chat.optedOutAt);
  }

  return rows.map(({ product, tenant, ...visit }) => {
    const { hasPhysicalLocation, address, placeId, latitude, longitude, slug, customDomain, ...rest } = tenant;
    const locationText = locationTextForBot({ hasPhysicalLocation, address, placeId, latitude, longitude, slug, customDomain, messageLanguage: rest.messageLanguage });
    // The customer gets the short video link of this visit (or the real one when the visit has no code).
    const { meetShortCode, patientKey, whatsappConsentAt, ...plain } = visit;
    const meetUrl = customerMeetUrl({ meetUrl: visit.meetUrl, meetShortCode }, { slug, customDomain }) || null;
    const optedOutAt = patientKey ? optOutByKey.get(`${visit.tenantId}:${patientKey}`) ?? null : null;
    return {
      ...plain,
      meetUrl,
      optedOutAt,
      whatsappConsentAt,
      productName: product.name,
      tenant: {
        ...rest,
        messagingPolicyMode: (rest.messagingPolicyMode === "ENFORCE" ? "ENFORCE" : "SHADOW") as MessagingPolicyMode,
        timeZone: usableTimeZone(rest.timeZone),
        locationText,
      },
    };
  });
}

