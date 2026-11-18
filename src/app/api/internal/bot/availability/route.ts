// src/app/api/internal/bot/availability/route.ts
// POST: Free slots for a service on a given day (native appointments + connected calendar),
// using the business's weekly opening hours. Every requested time gets one status: free, taken, closed (the business
// does not open then), past, or no_fit (open, but the service does not finish before closing).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { buildSlot, isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { blocksForDate, daySlots, insideBusinessHours, longestBlockMinutes, slotWithinHours } from "@/lib/business-hours";
import { isBookable } from "@/lib/bookable";
import { modalityModeFor } from "@/lib/patient-intake";
import { getBusyPeriods, isSlotFree } from "@/lib/calendar-sync";
import { clinicDateKeyOf, clinicDateTime, clinicOffsetOf, isRealClinicTime } from "@/lib/clinic-time";
import { availabilityMessage } from "@/lib/availability-message";
import {
  classifyRequestedTime,
  normalizeClock,
  SLOTS_OFFERED_PER_REPLY,
  slotQuery,
  weekdayNameEs,
  type RequestedStatus,
} from "@/lib/slot-query";

function invalid(error: string, message: string) {
  return Response.json({ success: false, error, message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, productId, date, after, time: timeParam, edge: edgeParam } = await req.json().catch(() => ({}));
  // The agent sends empty strings for optional fields it leaves out: they count as not sent.
  const wantedTime = timeParam === "" || timeParam === null ? undefined : timeParam;
  const wantedEdge = edgeParam === "" || edgeParam === null ? undefined : edgeParam;
  const wantedAfter = after === "" || after === null ? undefined : after;
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  if (typeof productId !== "string" || typeof date !== "string") {
    return Response.json({ error: "productId y date son requeridos" }, { status: 400 });
  }
  if (weekdayNameEs(date) === null) return invalid("date_invalid", "La fecha debe ser AAAA-MM-DD y existir en el calendario.");

  // One clock time per call: an exact time, or the first or last of the day, never both.
  if (wantedTime !== undefined && (typeof wantedTime !== "string" || normalizeClock(wantedTime) === null)) {
    return invalid("time_invalid", "time debe ser una hora HH:mm en 24 horas, por ejemplo 09:00 o 17:30.");
  }
  if (wantedEdge !== undefined && wantedEdge !== "first" && wantedEdge !== "last") {
    return invalid("edge_invalid", "edge debe ser first o last.");
  }
  if (wantedTime !== undefined && wantedEdge !== undefined) {
    return invalid("time_and_edge", "Envía time o edge, no los dos.");
  }
  if (wantedAfter !== undefined && (typeof wantedAfter !== "string" || normalizeClock(wantedAfter) === null)) {
    return invalid("after_invalid", "after debe ser una hora HH:mm en 24 horas.");
  }
  const timeAsked = wantedTime !== undefined ? normalizeClock(wantedTime as string) : null;
  const afterTime = wantedAfter !== undefined ? normalizeClock(wantedAfter as string) : null;
  const edgeAsked = wantedEdge === "first" || wantedEdge === "last" ? wantedEdge : null;

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
  if (duration <= 0) return invalid("service_duration_invalid", "Este servicio no tiene una duración válida.");

  const zone = bot.timeZone;
  const now = Date.now();
  const pastDate = date < clinicDateKeyOf(new Date(now), zone);
  const busy = await getBusyPeriods(bot.tenantId, date, zone);

  // Past times on today's date are left out of the grid: they are neither free nor offered.
  const grid = daySlots(bot.businessHours, date, duration).filter((time) => {
    const slot = buildSlot(date, time, duration, bot.businessHours, zone);
    return slot ? slot.start.getTime() > now : false;
  });
  const free = grid.filter((time) => {
    const slot = buildSlot(date, time, duration, bot.businessHours, zone);
    return slot !== null && isSlotFree(busy, slot.start, slot.end);
  });

  // The status of the exact time asked, from its facts: not a grid lookup, so a time that is open but is not on the
  // grid of the service (09:15 for a 30 minute service that starts at 09:00) is answered as free or taken.
  let status: RequestedStatus | null = null;
  if (timeAsked !== null) {
    const inside = insideBusinessHours(bot.businessHours, date, timeAsked) && isRealClinicTime(date, timeAsked, zone);
    const fits = slotWithinHours(bot.businessHours, date, timeAsked, duration);
    const slot = buildSlot(date, timeAsked, duration, bot.businessHours, zone);
    const startsAt = inside ? new Date(clinicDateTime(date, timeAsked, zone)).getTime() : NaN;
    status = classifyRequestedTime({
      inside,
      past: pastDate || startsAt <= now,
      fits,
      free: slot !== null && isSlotFree(busy, slot.start, slot.end),
    });
  }

  const query = slotQuery({
    grid,
    free,
    time: timeAsked,
    status,
    edge: edgeAsked,
    after: afterTime,
    limit: SLOTS_OFFERED_PER_REPLY,
  });

  return Response.json({
    success: true,
    serviceName: product.name,
    date,
    // The day of the week of the date asked: the agent says it, so a wrong weekday ("sabado 15") shows up.
    weekday: weekdayNameEs(date),
    // The business zone (ticket #111): same "<IANA> (UTC<offset>)" text as before, plus how the customer reads it.
    timezone: `${zone} (UTC${clinicOffsetOf(new Date(clinicDateTime(date, "12:00", zone)), zone)})`,
    timeZone: zone,
    timeZoneLabel: bot.timeZoneLabel,
    durationMinutes: duration,
    // How this service is delivered (IN_PERSON, ONLINE or ASK), so the agent tells the customer before booking.
    modalityMode: modalityModeFor(bot.serviceModes, product.visitModes),
    requested: query.requested,
    edgeTime: query.edgeTime,
    availableSlots: query.availableSlots,
    hasMore: query.hasMore,
    message: availabilityMessage(date, query, {
      pastDate,
      closedDay: blocksForDate(bot.businessHours, date).length === 0,
      serviceTooLong: duration > longestBlockMinutes(bot.businessHours),
      durationMinutes: duration,
    }),
  });
}
