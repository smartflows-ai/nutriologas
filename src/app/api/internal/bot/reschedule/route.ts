// src/app/api/internal/bot/reschedule/route.ts
// POST: Move an upcoming appointment to a new free slot. Only the booking phone can reschedule.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { rescheduleAppointment } from "@/lib/appointments-service";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  buildSlot,
  formatSlotTime,
  isInternalKeyValid,
  resolveBotTenant,
} from "@/lib/bot";

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
      customerPhone: String(customerPhone),
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
  const slot = buildSlot(date, time, duration);
  if (!slot) {
    return Response.json(
      { success: false, error: "Fecha u hora fuera del horario de atención" },
      { status: 400 }
    );
  }
  if (slot.start.getTime() <= Date.now()) {
    return Response.json({ success: false, error: "La nueva fecha y hora ya pasaron" }, { status: 400 });
  }

  const result = await rescheduleAppointment({
    tenantId: bot.tenantId,
    appointment,
    newStart: slot.start,
    checkConflicts: true,
  });
  if (!result.ok) {
    return Response.json(
      { success: false, error: "slot_unavailable", message: "Ese horario no está disponible." },
      { status: 409 }
    );
  }

  return Response.json({
    success: true,
    appointmentId: appointment.id,
    serviceName: appointment.product.name,
    date,
    time: formatSlotTime(slot.start),
    durationMinutes: duration,
  });
}
