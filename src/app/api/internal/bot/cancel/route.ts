// src/app/api/internal/bot/cancel/route.ts
// POST: Cancel an upcoming appointment. Only the phone number that booked it can cancel it.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cancelAppointment } from "@/lib/appointments-service";
import { ACTIVE_APPOINTMENT_STATUSES, isInternalKeyValid, resolveBotTenant } from "@/lib/bot";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, customerPhone, appointmentId } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });
  if (!customerPhone || !appointmentId) {
    return Response.json({ error: "customerPhone y appointmentId son requeridos" }, { status: 400 });
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

  await cancelAppointment(bot.tenantId, appointment, "CANCELLED");

  return Response.json({
    success: true,
    cancelled: {
      appointmentId: appointment.id,
      serviceName: appointment.product.name,
      startsAt: appointment.appointmentDate.toISOString(),
    },
  });
}
