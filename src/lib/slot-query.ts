// src/lib/slot-query.ts
// What the WhatsApp agent asks about a day's free times: one exact time, the first or last free time of the day,
// or the next free times after one already offered. Pure: the route passes the grid (the start times the business
// offers for this service that day, from now on) and the free ones. No I/O.

const WEEKDAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** Hours offered per reply: a short list, never the whole day. */
export const SLOTS_OFFERED_PER_REPLY = 3;

export type SlotEdge = "first" | "last";
export type RequestedStatus = "free" | "taken" | "closed" | "past" | "no_fit";

export interface SlotQueryInput {
  /** Every start time offered that day for this service, "HH:mm", from now on (times already past are left out). */
  readonly grid: readonly string[];
  /** The subset of grid that is free right now, "HH:mm". */
  readonly free: readonly string[];
  /** An exact time the customer asked for, "HH:mm". */
  readonly time?: string | null;
  /** The status of `time`, decided by the route (see classifyRequestedTime). Without it the grid decides. */
  readonly status?: RequestedStatus | null;
  /** "first" or "last" free time of the day. */
  readonly edge?: SlotEdge | null;
  /** Exclusive: the free times strictly after this one (legacy paging). */
  readonly after?: string | null;
  readonly limit?: number;
}

export interface SlotQueryResult {
  readonly requested: { readonly time: string; readonly status: RequestedStatus } | null;
  readonly availableSlots: string[];
  readonly hasMore: boolean;
  readonly edgeTime: string | null;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The Spanish weekday of a real calendar date (YYYY-MM-DD), or null when the date is malformed or does not exist. */
export function weekdayNameEs(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCDate() !== day || at.getUTCMonth() !== month - 1) return null;
  return WEEKDAYS_ES[at.getUTCDay()];
}

/** The `limit` free times closest to the wanted time (the wanted time itself left out), returned in time order. */
function nearestTo(free: readonly string[], wanted: string, limit: number): string[] {
  const target = minutesOf(wanted);
  return free
    .filter((time) => time !== wanted)
    .sort((a, b) => Math.abs(minutesOf(a) - target) - Math.abs(minutesOf(b) - target) || minutesOf(a) - minutesOf(b))
    .slice(0, limit)
    .sort((a, b) => minutesOf(a) - minutesOf(b));
}

export function slotQuery(input: SlotQueryInput): SlotQueryResult {
  const limit = Math.max(1, input.limit ?? SLOTS_OFFERED_PER_REPLY);
  const freeSet = new Set(input.free);
  const free = input.grid.filter((time) => freeSet.has(time)).sort((a, b) => minutesOf(a) - minutesOf(b));

  if (input.time) {
    const time = input.time;
    const status: RequestedStatus = input.status ?? (!input.grid.includes(time) ? "closed" : freeSet.has(time) ? "free" : "taken");
    return { requested: { time, status }, availableSlots: nearestTo(free, time, limit), hasMore: false, edgeTime: null };
  }

  if (input.edge) {
    const edgeTime = input.edge === "first" ? (free[0] ?? null) : (free[free.length - 1] ?? null);
    return { requested: null, availableSlots: edgeTime ? [edgeTime] : [], hasMore: false, edgeTime };
  }

  const later = input.after ? free.filter((time) => minutesOf(time) > minutesOf(input.after as string)) : free;
  const offered = later.slice(0, limit);
  return { requested: null, availableSlots: offered, hasMore: later.length > offered.length, edgeTime: null };
}

/** The facts about one requested time, found by the route. */
export interface RequestedTimeFacts {
  /** The business is open at that start time (a block of that day contains it). */
  readonly inside: boolean;
  /** The time is already past (today's earlier hours, or any hour of a past date). */
  readonly past: boolean;
  /** A session of this service fits inside the block before it closes. */
  readonly fits: boolean;
  /** The session does not collide with another visit or a calendar event. */
  readonly free: boolean;
}

/**
 * One status per requested time, in this order: past, closed, does not fit, then free or taken.
 * An open hour is never reported as closed, and a closed hour never as taken.
 */
export function classifyRequestedTime(facts: RequestedTimeFacts): RequestedStatus {
  if (facts.past) return "past";
  if (!facts.inside) return "closed";
  if (!facts.fits) return "no_fit";
  return facts.free ? "free" : "taken";
}

const CLOCK_RE = /^(\d{1,2}):(\d{2})$/;

/** "9:00" and "09:00" are the same hour. Anything else (seconds, am/pm, 25:00) is not a clock time: null. */
export function normalizeClock(value: string): string | null {
  const match = CLOCK_RE.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}
