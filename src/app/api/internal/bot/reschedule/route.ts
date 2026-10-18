// src/app/api/internal/bot/reschedule/route.ts
// POST: Move an upcoming appointment to a new free slot. Only the booking phone can reschedule.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { updateCalendarEvent } from "@/lib/google-calendar";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  buildSlot,
  formatSlotTime,
  getBusyPeriods,
  getTenantAccessToken,
  isInternalKeyValid,
  isSlotFree,
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

  const accessToken = await getTenantAccessToken(bot.tenantId);
  const busy = await getBusyPeriods(bot.tenantId, date, accessToken);
  // The appointment's own current slot must not count as a conflict.
  if (!isSlotFree(busy, slot.start, slot.end, { appointmentId: appointment.id, googleEventId: appointment.googleEventId })) {
    return Response.json(
      { success: false, error: "slot_unavailable", message: "Ese horario no está disponible." },
      { status: 409 }
    );
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      appointmentDate: slot.start,
      remindersSent: [], // a new time gets its own reminders
    },
  });

  if (accessToken && appointment.googleEventId) {
    try {
      await updateCalendarEvent(accessToken, appointment.googleEventId, {
        startDateTime: slot.start.toISOString(),
        endDateTime: slot.end.toISOString(),
      });
    } catch (err) {
      console.error("[bot/reschedule] Google Calendar update failed:", err);
    }
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
