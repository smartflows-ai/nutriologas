// src/lib/bot-visit-view.ts
// How the app describes one visit to the WhatsApp bot (ticket #111). Pure: no database or request access.
//   R1. The time is the business's own (Tenant.timeZone), with the date, weekday and zone name already worked out
//       (the model never converts UTC or guesses a zone).
//   R2. An online visit carries its video link and never the address; an in person visit carries the address and never a link.
// Used by bot/my-appointments and bot/reschedule (whole view) and bot/cancel (time only).
import { clinicDateKeyOf, clinicIsoOf, clinicTimeLabel, clinicWeekdayOf } from "./clinic-time";
import { customerMeetUrl } from "./short-links";

export type VisitModality = "IN_PERSON" | "ONLINE";

export interface BotVisitSource {
  appointmentDate: Date;
  modality: VisitModality | null;
  meetUrl: string | null;
  meetShortCode: string | null;
}

/** The business zone, as resolveBotTenant returns it. */
export interface BotVisitZone {
  /** IANA name: "America/Cancun". */
  timeZone: string;
  /** How the customer reads it: "hora de Cancún". */
  timeZoneLabel: string;
}

/** The business data the view needs, as resolveBotTenant (src/lib/bot.ts) already returns it. */
export interface BotVisitPlace extends BotVisitZone {
  shortLinkTenant: { slug: string; customDomain: string | null };
  /** Address with directions link; "" when the business has no physical location. */
  locationText: string;
}

export interface BotVisitTime extends BotVisitZone {
  /** ISO instant with the business offset of that day, e.g. "2026-11-17T20:30:00-05:00" in Cancun. */
  startsAt: string;
  /** YYYY-MM-DD on the business calendar. */
  date: string;
  /** "07:30 p.m.", the same text book_appointment sends. */
  time: string;
  /** "martes". */
  weekday: string;
}

export interface BotVisitView extends BotVisitTime {
  modality: VisitModality | null;
  /** Online only: the short link, or the real one when the visit has no code; null when there is no link. */
  meetLink: string | null;
  /** Not online (null modality counts as in person, like book and the reminders): the address; null otherwise. */
  location: string | null;
}

/** The time of a visit as the bot reads it. startsAt is the same instant, written with the business offset. */
export function botVisitTime(appointmentDate: Date, zone: BotVisitZone): BotVisitTime {
  const tz = zone.timeZone;
  return {
    startsAt: clinicIsoOf(appointmentDate, tz),
    date: clinicDateKeyOf(appointmentDate, tz),
    time: clinicTimeLabel(appointmentDate, tz),
    weekday: clinicWeekdayOf(appointmentDate, tz),
    timeZone: tz,
    timeZoneLabel: zone.timeZoneLabel,
  };
}

export function botVisitView(visit: BotVisitSource, place: BotVisitPlace): BotVisitView {
  const online = visit.modality === "ONLINE";
  return {
    ...botVisitTime(visit.appointmentDate, place),
    modality: visit.modality,
    meetLink: online ? customerMeetUrl(visit, place.shortLinkTenant) || null : null,
    location: online ? null : place.locationText || null,
  };
}
