// src/app/api/internal/bot/my-appointments/route.ts
// POST: Upcoming active appointments for one WhatsApp customer.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ACTIVE_APPOINTMENT_STATUSES, isInternalKeyValid, resolveBotTenant } from "@/lib/bot";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, customerPhone } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });
  if (!customerPhone) return Response.json({ error: "customerPhone es requerido" }, { status: 400 });

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: bot.tenantId,
      customerPhone: String(customerPhone),
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      appointmentDate: { gte: new Date() },
    },
    select: {
      id: true,
      appointmentDate: true,
      durationMinutes: true,
      status: true,
      product: { select: { name: true } },
    },
    orderBy: { appointmentDate: "asc" },
    take: 10,
  });

  return Response.json({
    appointments: appointments.map((a) => ({
      appointmentId: a.id,
      serviceName: a.product.name,
      startsAt: a.appointmentDate.toISOString(),
      durationMinutes: a.durationMinutes,
      status: a.status,
    })),
  });
}
