// src/app/api/internal/bot/availability/route.ts
// POST: Free slots for a service on a given day (native appointments + Google Calendar).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  BOT_DAY_END,
  BOT_DAY_START,
  BOT_TIMEZONE_OFFSET,
  buildSlot,
  isInternalKeyValid,
  resolveBotTenant,
} from "@/lib/bot";
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
    select: { name: true, durationMinutes: true },
  });
  if (!product) return Response.json({ error: "Servicio no encontrado" }, { status: 404 });

  const duration = product.durationMinutes ?? 30;
  const busy = await getBusyPeriods(bot.tenantId, date);

  // Candidate slots step by the service duration, like the web booking flow.
  const [startH, startM] = BOT_DAY_START.split(":").map(Number);
  const [endH, endM] = BOT_DAY_END.split(":").map(Number);
  const dayStartMin = startH * 60 + startM;
  const dayEndMin = endH * 60 + endM;

  const availableSlots: string[] = [];
  for (let current = dayStartMin; current + duration <= dayEndMin; current += duration) {
    const time = `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`;
    const slot = buildSlot(date, time, duration);
    if (slot && isSlotFree(busy, slot.start, slot.end)) availableSlots.push(time);
  }

  // Past slots on today's date are not offered.
  const now = Date.now();
  const offered = availableSlots.filter((time) => {
    const slot = buildSlot(date, time, duration);
    return slot ? slot.start.getTime() > now : false;
  });

  return Response.json({
    success: true,
    serviceName: product.name,
    date,
    timezone: `America/Mexico_City (UTC${BOT_TIMEZONE_OFFSET})`,
    durationMinutes: duration,
    availableSlots: offered,
    message:
      offered.length > 0
        ? `Hay ${offered.length} horarios disponibles el ${date}.`
        : `No hay horarios disponibles el ${date} para este servicio.`,
  });
}
