// src/lib/availability-message.ts
// The sentence the WhatsApp agent reads after checking a day's times. It says why a time cannot be booked (closed,
// already past, taken, or open but too short a window for the service) and lists only the times the tool returned.
// Pure: no I/O.
import type { SlotQueryResult } from "@/lib/slot-query";

export interface AvailabilityContext {
  /** The date is before today in the business zone: no time of it can be offered. */
  readonly pastDate: boolean;
  /** The business has no opening block that day. */
  readonly closedDay: boolean;
  /** The service is longer than every block of the business: no time can ever fit it. */
  readonly serviceTooLong: boolean;
  readonly durationMinutes: number;
}

function tailFor(list: string): string {
  return list ? ` Ofrece solo estas: ${list}.` : " No hay horarios libres cercanos.";
}

export function availabilityMessage(date: string, query: SlotQueryResult, ctx: AvailabilityContext): string {
  const list = query.availableSlots.join(", ");

  if (ctx.pastDate) return `La fecha ${date} ya pasó. No hay horarios que ofrecer.`;
  if (ctx.serviceTooLong) {
    return `Este servicio dura ${ctx.durationMinutes} min y ningún horario del negocio es tan largo. No ofrezcas horas para él.`;
  }

  if (query.requested) {
    const { time, status } = query.requested;
    if (status === "free") return `La hora ${time} está libre el ${date}. Confírmala con el cliente antes de agendar.`;
    if (ctx.closedDay || status === "closed") {
      return ctx.closedDay
        ? `El negocio no atiende el ${date}. Ofrece otro día.`
        : `El negocio no atiende a las ${time} el ${date}.${tailFor(list)}`;
    }
    if (status === "past") return `La hora ${time} del ${date} ya pasó.${tailFor(list)}`;
    if (status === "no_fit") {
      return `El negocio está abierto a las ${time} el ${date}, pero este servicio (${ctx.durationMinutes} min) no termina antes del cierre.${tailFor(list)}`;
    }
    return `La hora ${time} está ocupada el ${date}.${tailFor(list)}`;
  }

  if (ctx.closedDay) return `El negocio no atiende el ${date}. Ofrece otro día.`;
  if (query.edgeTime !== null) return `La hora libre de ese día es ${query.edgeTime} el ${date}.`;
  if (query.availableSlots.length === 0) {
    return `Ese dia ya no hay horarios libres para este servicio (${date}). No es un error: dile al cliente que ese dia no hay lugares y ofrece otro dia.`;
  }
  return `Hay horarios disponibles el ${date}. Ofrece solo estos ${query.availableSlots.length}.`;
}
