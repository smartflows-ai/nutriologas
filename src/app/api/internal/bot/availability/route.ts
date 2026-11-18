// src/app/api/internal/bot/availability/route.ts
// POST: Free slots for a service on a given day (native appointments + connected calendar),
// using the business's weekly opening hours.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { buildSlot, isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { daySlots } from "@/lib/business-hours";
import { isBookable } from "@/lib/bookable";
import { modalityModeFor } from "@/lib/patient-intake";
import { getBusyPeriods, isSlotFree } from "@/lib/calendar-sync";
import { SLOTS_OFFERED_PER_REPLY, slotQuery, weekdayNameEs, type SlotQueryResult } from "@/lib/slot-query";

const TIME_RE = /^\d{2}:\d{2}$/;

/** The sentence the agent reads: states what was asked and lists only the times the tool returned. */
function availabilityMessage(date: string, query: SlotQueryResult): string {
  const list = query.availableSlots.join(", ");
  if (query.requested) {
    const { time, status } = query.requested;
    if (status === "free") return `La hora ${time} está libre el ${date}. Confírmala con el cliente antes de agendar.`;
    const reason = status === "taken" ? "está ocupada" : "no es hora de atención para este servicio";
    return list
      ? `La hora ${time} ${reason} el ${date}. Ofrece solo estas: ${list}.`
      : `La hora ${time} ${reason} el ${date} y no hay horarios libres cercanos.`;
  }
  if (query.edgeTime !== null) return `La hora libre de ese día es ${query.edgeTime} el ${date}.`;
  if (query.availableSlots.length === 0) return `No hay mas horarios disponibles el ${date} para este servicio.`;
  return `Hay horarios disponibles el ${date}. Ofrece solo estos ${query.availableSlots.length}.`;
}

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, productId, date, after, time: timeParam, edge: edgeParam } = await req.json().catch(() => ({}));
  // The agent sends empty strings for optional fields it leaves out: they count as not sent.
  const wantedTime = timeParam === "" || timeParam === null ? undefined : timeParam;
  const wantedEdge = edgeParam === "" || edgeParam === null ? undefined : edgeParam;
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  if (typeof productId !== "string" || typeof date !== "string") {
    return Response.json({ error: "productId y date son requeridos" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId: bot.tenantId, isActive: true, deletedAt: null },
    select: { name: true, durationMinutes: true, requiresBooking: true, visitModes: true },
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

  // Past times on today's date are left out of the grid: they are neither free nor offered.
  const now = Date.now();
  const grid = daySlots(bot.businessHours, date, duration).filter((time) => {
    const slot = buildSlot(date, time, duration, bot.businessHours);
    return slot ? slot.start.getTime() > now : false;
  });
  const free = grid.filter((time) => {
    const slot = buildSlot(date, time, duration, bot.businessHours);
    return slot !== null && isSlotFree(busy, slot.start, slot.end);
  });

  // Exact time ("18:00") or edge ("first" | "last"); `after` (HH:mm, exclusive) pages the next ones.
  const timeAsked = typeof wantedTime === "string" && TIME_RE.test(wantedTime) ? wantedTime : null;
  const edgeAsked = wantedEdge === "first" || wantedEdge === "last" ? wantedEdge : null;
  if ((wantedTime !== undefined && timeAsked === null) || (wantedEdge !== undefined && edgeAsked === null)) {
    return Response.json({ error: "time_invalid", message: "time debe ser HH:mm y edge first o last." }, { status: 400 });
  }
  const afterTime = typeof after === "string" && TIME_RE.test(after) ? after : null;
  const query = slotQuery({ grid, free, time: timeAsked, edge: edgeAsked, after: afterTime, limit: SLOTS_OFFERED_PER_REPLY });

  return Response.json({
    success: true,
    serviceName: product.name,
    date,
    // The day of the week of the date asked: the agent says it, so a wrong weekday ("sabado 15") shows up.
    weekday: weekdayNameEs(date),
    timezone: "America/Mexico_City (UTC-06:00)",
    durationMinutes: duration,
    // How this service is delivered (IN_PERSON, ONLINE or ASK), so the agent tells the customer before booking.
    modalityMode: modalityModeFor(bot.serviceModes, product.visitModes),
    requested: query.requested,
    edgeTime: query.edgeTime,
    availableSlots: query.availableSlots,
    hasMore: query.hasMore,
    message: availabilityMessage(date, query),
  });
}
