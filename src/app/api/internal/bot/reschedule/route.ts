// src/app/api/internal/bot/reschedule/route.ts
// POST: Move an upcoming appointment to a new free slot. Only the booking phone (or the visit's own number) can reschedule.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { rescheduleAppointment } from "@/lib/appointments-service";
import { botSlotTakenBody } from "@/lib/free-slots";
import { ACTIVE_APPOINTMENT_STATUSES, buildSlot, isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { botVisitView } from "@/lib/bot-visit-view";
import { visitsOfSender } from "@/lib/patient-intake";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, customerPhone, appointmentId, date, time } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });
  if (!customerPhone || !appointmentId || !date || !time) {
    return Response.json(
      { success: false, error: "Faltan datos: customerPhone, appointmentId, date, time" },
      { status: 400 }
    );
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: String(appointmentId),
      tenantId: bot.tenantId,
      deletedAt: null,
      // The person writing: their own visits and the ones they booked for others (recommended by them).
      ...visitsOfSender(String(customerPhone)),
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      appointmentDate: { gte: new Date() },
    },
    include: { product: { select: { name: true } } },
  });
  if (!appointment) {
    return Response.json(
      { success: false, error: "No encontramos una cita activa con ese identificador para este número." },
      { status: 404 }
    );
  }

  const duration = appointment.durationMinutes;
  const slot = buildSlot(date, time, duration, bot.businessHours, bot.timeZone);
  if (!slot) {
    return Response.json(
      { success: false, error: "Fecha u hora fuera del horario de atención" },
      { status: 400 }
    );
  }
  if (slot.start.getTime() <= Date.now()) {
    return Response.json({ success: false, error: "La nueva fecha y hora ya pasaron" }, { status: 400 });
  }

  // No visit limit here (ticket #141): moving a visit does not add one, and old data over the limit must not block a change of time.

  const result = await rescheduleAppointment({
    tenantId: bot.tenantId,
    appointment,
    newStart: slot.start,
    checkConflicts: true,
  });
  if (!result.ok) {
    const body = await botSlotTakenBody({
      tenantId: bot.tenantId,
      zone: bot.timeZone,
      hours: bot.businessHours,
      durationMinutes: duration,
      target: slot.start,
      now: new Date(),
      // The visit being moved does not block its own current slot.
      exclude: { appointmentId: appointment.id, externalEventId: appointment.externalEventId },
    });
    return Response.json(body, { status: 409 });
  }

  return Response.json({
    success: true,
    appointmentId: appointment.id,
    serviceName: appointment.product.name,
    durationMinutes: duration,
    // The moved visit in the business zone with weekday; an online visit keeps its video link and gets no address.
    ...botVisitView(result.appointment, bot),
  });
}
