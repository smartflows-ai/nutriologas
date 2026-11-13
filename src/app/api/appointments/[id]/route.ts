// src/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { apiError } from "@/lib/api-errors";
import { cancelAppointment, rescheduleAppointment } from "@/lib/appointments-service";
import { syncCalendarDelete } from "@/lib/calendar-sync";
import { saveVisitNote } from "@/lib/appointment-notes";
import { can, omitClinicalNotes } from "@/lib/permissions";
import { requirePermission } from "@/lib/permission-guard";
import { omitReminderError, safeFailureReason } from "@/lib/reminder-state";
import { AppointmentStatus } from "@prisma/client";
import { withBookedBy, withMeetingLink } from "@/lib/reminder-messages";

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

    const appointment = await prisma.appointment.findFirst({
      where: { id: params.id, tenantId },
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
    const { status, internalNotes, notes, appointmentDate } = body;

    // Invalid input and fields a role may not change are refused before anything is written
    // (a reschedule moves the calendar event, so it must never run ahead of a request that will fail).
    if (status !== undefined && !APPOINTMENT_STATUSES.includes(status)) {
      return apiError("status_invalid", 400);
    }
    if (internalNotes !== undefined && !canNotes) {
      return apiError("appointment_update_forbidden", 403);
    }
    if (appointmentDate && !can(role, "appointments.reschedule")) {
      return apiError("appointment_update_forbidden", 403);
    }

    const dataToUpdate: any = {};

    if (status) {
      // Clientes solo pueden CANCELAR su propia cita
      if (!managesAgenda && status !== "CANCELLED") {
        return apiError("appointment_cancel_forbidden", 403);
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
      dataToUpdate.notes = notes;
    }

    // A new time moves the mirror event and restarts reminders; cancellation removes the mirror event.
    if (appointmentDate) {
      await rescheduleAppointment({
        tenantId,
        appointment,
        newStart: new Date(appointmentDate),
        checkConflicts: false, // the admin may deliberately overbook
      });
    }
    if (status === "CANCELLED" || status === "NO_SHOW") {
      await cancelAppointment(tenantId, appointment, status);
    }

    const updated = await prisma.appointment.update({
      where: { id: params.id },
      data: dataToUpdate,
      include: {
        product: { select: { name: true, durationMinutes: true, price: true, priceMode: true } },
        user: { select: { name: true, email: true } },
      },
    });

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

      if (patientPhone) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        const tenantName = tenant?.name || "Clínica";
        const patientName = updated.customerName || updated.user?.name || "Paciente";
        const serviceName = updated.product?.name || "Consulta Médica";

        const formattedDate = new Date(updated.appointmentDate).toLocaleDateString("es-MX", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const formattedTime = new Date(updated.appointmentDate).toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

        const baseMessage = `¡Hola, ${patientName}! 👋\n\nTu cita en *${tenantName}* ha sido *CONFIRMADA* con éxito por el especialista. 🩺✨\n\n📅 *Fecha:* ${formattedDate}\n⏰ *Horario:* ${formattedTime}\n🩺 *Servicio:* ${serviceName}\n⏱️ *Duración estimada:* ${updated.durationMinutes} min\n\nSi tienes alguna duda o necesitas reagendar, puedes responder a este mensaje. ¡Te esperamos!`;

        // This message is written in Spanish; an online visit also gets its video call link.
        const message = withBookedBy(withMeetingLink(baseMessage, updated, "es"), updated, "es");

        const waRes = await sendWhatsAppMessage({
          tenantId,
          to: patientPhone,
          text: message,
        });

        whatsappSent = waRes.success;
        whatsappReason = waRes.reason ? safeFailureReason(waRes.reason) : undefined;
      }
    }

    return NextResponse.json({ ...omitClinicalNotes(role, omitReminderError(updated)), whatsappSent, whatsappReason });
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
    const { tenantId } = access;

    const appointment = await prisma.appointment.findFirst({
      where: { id: params.id, tenantId },
    });

    if (!appointment) {
      return apiError("appointment_not_found", 404);
    }

    // Remove the mirror event first. If that fails, keep the row so the event is not orphaned.
    const removed = await syncCalendarDelete(tenantId, appointment);
    if (!removed) return apiError("calendar_sync_failed", 502);

    await prisma.appointment.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[DELETE /api/appointments/[id]] Error:", error);
    return apiError("internal_error", 500);
  }
}
