// src/app/api/internal/bot/availability/route.ts
// POST: Free slots for a service on a given day (native appointments + connected calendar),
// using the business's weekly opening hours.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { buildSlot, isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { daySlots } from "@/lib/business-hours";
import { isBookable } from "@/lib/bookable";
import { getBusyPeriods, isSlotFree } from "@/lib/calendar-sync";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, productId, date } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  if (typeof productId !== "string" || typeof date !== "string") {
    return Response.json({ error: "productId y date son requeridos" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId: bot.tenantId, isActive: true, deletedAt: null },
    select: { name: true, durationMinutes: true, requiresBooking: true },
  });
  if (!product) return Response.json({ error: "Servicio no encontrado" }, { status: 404 });
  if (!isBookable(product, bot)) {
    return Response.json(
      { success: false, error: "not_bookable", message: "Este artículo no se agenda con cita." },
      { status: 400 }
    );
  }

  const duration = product.durationMinutes ?? 30;
  const busy = await getBusyPeriods(bot.tenantId, date);

  const candidates = daySlots(bot.businessHours, date, duration);
  const availableSlots = candidates.filter((time) => {
    const slot = buildSlot(date, time, duration, bot.businessHours);
    return slot !== null && isSlotFree(busy, slot.start, slot.end);
  });

  // Past slots on today's date are not offered.
  const now = Date.now();
  const offered = availableSlots.filter((time) => {
    const slot = buildSlot(date, time, duration, bot.businessHours);
    return slot ? slot.start.getTime() > now : false;
  });

  return Response.json({
    success: true,
    serviceName: product.name,
    date,
    timezone: "America/Mexico_City (UTC-06:00)",
    durationMinutes: duration,
    availableSlots: offered,
    message:
      offered.length > 0
        ? `Hay ${offered.length} horarios disponibles el ${date}.`
        : `No hay horarios disponibles el ${date} para este servicio.`,
  });
}
