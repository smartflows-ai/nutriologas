// src/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { apiError } from "@/lib/api-errors";
import { cancelAppointment, softDeleteAppointment } from "@/lib/appointments-service";
import { findNonEditableField, parseNotesField, trailRoleOf } from "@/lib/appointment-admin-rules";
import { editFromPanel, isPanelEdit, reopenFromPanel } from "@/lib/panel-appointments";
import { notifyCancelledFromPanel, notifyMovedFromPanel, ownerConfirmationText } from "@/lib/reminder-actions";
import { saveVisitNote } from "@/lib/appointment-notes";
import { can, omitClinicalNotes } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { omitReminderError, safeFailureReason } from "@/lib/reminder-state";
import { AppointmentStatus } from "@prisma/client";
import { withBookedBy } from "@/lib/reminder-messages";
import { customerMeetUrl } from "@/lib/short-links";
import { usableTimeZone } from "@/lib/tenant-time-zone";

const APPOINTMENT_STATUSES: readonly string[] = Object.values(AppointmentStatus);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiError("unauthorized", 401);
    }

    const tenantId = (session.user as any).tenantId;
    const userId = session.user.id!;
    const role = session.user.role;
    // ADMIN and STAFF manage any appointment of the business; a customer only their own.
    const managesAgenda = can(role, "appointments.status");
    const canNotes = can(role, "appointments.notes");

    // A deleted visit cannot be edited, confirmed or cancelled; it can only be restored (ticket #103).
    const appointment = await prisma.appointment.findFirst({
      where: { id: params.id, tenantId, deletedAt: null },
    });

    if (!appointment) {
      return apiError("appointment_not_found", 404);
    }

    // Si no gestiona la agenda, solo un CUSTOMER dueño de la cita puede tocarla (un rol desconocido no puede nada).
    const isOwnerCustomer = role === "CUSTOMER" && appointment.userId === userId;
    if (!managesAgenda && !isOwnerCustomer) {
      return apiError("appointment_update_forbidden", 403);
    }

    const body = await req.json();
    const { status, internalNotes, notes } = body;
    const now = new Date();

    // Invalid input and fields a role may not change are refused before anything is written
    // (an edit moves the calendar event, so it must never run ahead of a request that will fail).
    if (status !== undefined && !APPOINTMENT_STATUSES.includes(status)) {
      return apiError("status_invalid", 400);
    }
    if (internalNotes !== undefined && !canNotes) {
      return apiError("appointment_update_forbidden", 403);
    }
    // The phone is the patient's identity (history, reminders): never changed on an existing visit (ticket #103).
    if (findNonEditableField(body)) {
      return apiError("field_not_editable", 400);
    }

    // Editing the visit itself from /admin/citas: service, time, patient details, reason (ticket #103).
    if (managesAgenda && isPanelEdit(body)) {
      if (!can(role, "appointments.reschedule")) return apiError("appointment_update_forbidden", 403);
      // An edit and a status change are separate actions on the screen.
      if (status !== undefined || internalNotes !== undefined) return apiError("validation_failed", 400);
      const response = await editFromPanel({ role, tenantId, appointment, body, now });
      // Hole 1: a visit moved from the panel tells the patient its new time (best effort, never changes the answer).
      if (response.status === 200 && body.appointmentDate !== undefined) {
        await notifyMovedFromPanel(params.id, tenantId).catch((error: unknown) =>
          console.error("[panel] move notice failed", error instanceof Error ? error.name : "error"),
        );
      }
      return response;
    }
    if (body.appointmentDate !== undefined) {
      return apiError("appointment_update_forbidden", 403);
    }

    const dataToUpdate: any = {};
    let calendarSynced = true;

    if (status) {
      // Clientes solo pueden CANCELAR su propia cita
      if (!managesAgenda && status !== "CANCELLED") {
        return apiError("appointment_cancel_forbidden", 403);
      }
      // Back to Pending or Confirmed from cancelled, no-show or attended follows the restore rules (owner decision of
      // 2026-11-14): a future visit needs its slot free, for every role, and gets its event and reminder back.
      if (managesAgenda) {
        const reopened = await reopenFromPanel({ tenantId, appointment, toStatus: status, now });
        if (!reopened.ok) return reopened.response;
        calendarSynced = reopened.calendarSynced;
      }
      dataToUpdate.status = status;
      // Confirming by hand counts as a real confirmation for the reminder job: no request to reply SI and no
      // release. Bot bookings are created CONFIRMED without this field, so the status alone cannot mean "confirmed".
      if (status === "CONFIRMED" && !appointment.customerConfirmedAt) {
        dataToUpdate.customerConfirmedAt = new Date();
      }
    }

    if (canNotes && internalNotes !== undefined) {
      dataToUpdate.internalNotes = internalNotes;
    }

    if (notes !== undefined) {
      // Same rule as the panel: text only, at most 2000 characters (security review S7).
      const parsedNotes = parseNotesField(notes);
      if (!parsedNotes.ok) return apiError(parsedNotes.error, 400);
      dataToUpdate.notes = parsedNotes.data;
    }

    // Cancellation removes the mirror event. (A new time goes through editFromPanel above.)
    if (status === "CANCELLED" || status === "NO_SHOW") {
      await cancelAppointment(tenantId, appointment, status);
    }

    // Only a visit that is still not deleted: a delete in between wins (security review S2).
    const written = await prisma.appointment.updateMany({
      where: { id: params.id, tenantId, deletedAt: null },
      data: dataToUpdate,
    });
    const updated =
      written.count > 0
        ? await prisma.appointment.findFirst({
            where: { id: params.id, tenantId, deletedAt: null },
            include: {
              product: { select: { name: true, durationMinutes: true, price: true, priceMode: true } },
              user: { select: { name: true, email: true } },
            },
          })
        : null;
    if (!updated) return apiError("appointment_not_found", 404);

    // Hole 1: a visit cancelled from the panel tells the patient (same text as the release; best effort).
    if (status === "CANCELLED") {
      await notifyCancelledFromPanel(params.id, tenantId).catch((error: unknown) =>
        console.error("[panel] cancel notice failed", error instanceof Error ? error.name : "error"),
      );
    }

    // The visit's note also goes into the patient's history (one row per visit).
    if (canNotes && internalNotes !== undefined) {
      await saveVisitNote(updated, String(internalNotes ?? ""), session.user.name ?? null);
    }

    let whatsappSent = false;
    let whatsappReason: string | undefined;

    // Cuando el doctor o admin confirma la cita, notificar al paciente por WhatsApp
    if (status === "CONFIRMED") {
      let patientPhone = updated.customerPhone;
      if (!patientPhone && updated.notes) {
        const match = updated.notes.match(/(?:Tel|WhatsApp|Cel|Teléfono)?[:\s]*([+0-9]{8,15})/i);
        if (match) patientPhone = match[1];
      }

      const tenant = patientPhone
        ? await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true, slug: true, customDomain: true, ownerName: true, messageLanguage: true, timeZone: true, cancellationTemplate: true },
          })
        : null;

      if (patientPhone && tenant) {
        // Same text as the Confirmaciones tab (ticket #103, D9): business time, the business language, no emojis,
        // and the short video link of an online visit. A visit booked for someone else says who booked it.
        const message = withBookedBy(
          ownerConfirmationText({
            id: updated.id,
            tenantId,
            customerPhone: patientPhone,
            customerName: updated.customerName || updated.user?.name || null,
            appointmentDate: updated.appointmentDate,
            externalProvider: updated.externalProvider,
            externalEventId: updated.externalEventId,
            productName: updated.product?.name ?? "",
            tenantName: tenant.name,
            ownerName: tenant.ownerName,
            messageLanguage: tenant.messageLanguage,
            timeZone: usableTimeZone(tenant.timeZone),
            cancellationTemplate: tenant.cancellationTemplate,
            modality: updated.modality,
            meetUrl: customerMeetUrl({ meetUrl: updated.meetUrl, meetShortCode: updated.meetShortCode }, tenant) || null,
          }),
          updated,
          tenant.messageLanguage
        );

        // A visit confirmation to the patient: transactional, consent taken from the visit (ENFORCE blocks without it).
        const waRes = await sendWhatsAppMessage({
          tenantId,
          to: patientPhone,
          text: message,
          purpose: "TRANSACTIONAL",
          consent: updated.whatsappConsentAt ? "YES" : "NO",
        });

        whatsappSent = waRes.success;
        whatsappReason = waRes.reason ? safeFailureReason(waRes.reason) : undefined;
      }
    }

    return NextResponse.json({ ...omitClinicalNotes(role, omitReminderError(updated)), whatsappSent, whatsappReason, calendarSynced });
  } catch (error: any) {
    console.error("[PATCH /api/appointments/[id]] Error:", error);
    return apiError("internal_error", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requirePermission("appointments.delete");
    if (!access.ok) return access.response;
    const { tenantId, session } = access;
    const role = trailRoleOf(access.role);
    if (!role || !session.user.id) return apiError("forbidden", 403);

    const appointment = await prisma.appointment.findFirst({
      where: { id: params.id, tenantId, deletedAt: null },
    });

    if (!appointment) {
      return apiError("appointment_not_found", 404);
    }

    // Soft delete (ticket #103): the mirror event goes first; if it cannot be removed the visit stays visible.
    const result = await softDeleteAppointment(tenantId, appointment, { userId: session.user.id, role });
    if (!result.ok) {
      return result.reason === "calendar_sync_failed"
        ? apiError("calendar_sync_failed", 502)
        : apiError("appointment_not_found", 404);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[DELETE /api/appointments/[id]] Error:", error);
    return apiError("internal_error", 500);
  }
}
