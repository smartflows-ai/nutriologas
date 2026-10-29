// src/lib/business-hours.ts
// Weekly opening hours of the business. One schedule is read by the web booking flow and the WhatsApp bot.
// Each day is a list of blocks (e.g. 09:00-13:00 and 14:00-18:00 leaves a lunch break). An empty list = closed.
import { z } from "zod";

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DayHours {
  start: string; // "HH:mm", clinic time
  end: string; // "HH:mm", clinic time
}

export type BusinessHours = Record<Weekday, DayHours[]>;

export const MAX_BLOCKS_PER_DAY = 4;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  sunday: [],
  monday: [{ start: "09:00", end: "18:00" }],
  tuesday: [{ start: "09:00", end: "18:00" }],
  wednesday: [{ start: "09:00", end: "18:00" }],
  thursday: [{ start: "09:00", end: "18:00" }],
  friday: [{ start: "09:00", end: "18:00" }],
  saturday: [{ start: "09:00", end: "18:00" }],
};

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const blockSchema = z
  .object({
    start: z.string().regex(TIME_REGEX),
    end: z.string().regex(TIME_REGEX),
  })
  .refine((block) => block.start < block.end, { message: "start_after_end" });

// Blocks of one day must not overlap. They are compared in time order, so the input order does not matter.
const dayBlocksSchema = z
  .array(blockSchema)
  .max(MAX_BLOCKS_PER_DAY)
  .refine(
    (blocks) => {
      const sorted = [...blocks].sort((a, b) => (a.start < b.start ? -1 : 1));
      return sorted.every((block, i) => i === 0 || sorted[i - 1].end <= block.start);
    },
    { message: "blocks_overlap" }
  );

export const businessHoursSchema = z.object({
  sunday: dayBlocksSchema,
  monday: dayBlocksSchema,
  tuesday: dayBlocksSchema,
  wednesday: dayBlocksSchema,
  thursday: dayBlocksSchema,
  friday: dayBlocksSchema,
  saturday: dayBlocksSchema,
});

export function parseBusinessHours(json: unknown): BusinessHours {
  const parsed = businessHoursSchema.safeParse(json);
  return parsed.success ? parsed.data : DEFAULT_BUSINESS_HOURS;
}

export function isDefaultBusinessHours(hours: BusinessHours): boolean {
  return JSON.stringify(hours) === JSON.stringify(DEFAULT_BUSINESS_HOURS);
}

export function weekdayOf(date: string): Weekday | null {
  if (!DATE_REGEX.test(date)) return null;
  const index = new Date(`${date}T00:00:00Z`).getUTCDay();
  return WEEKDAYS[index] ?? null;
}

export function blocksForDate(hours: BusinessHours, date: string): DayHours[] {
  const weekday = weekdayOf(date);
  return weekday ? hours[weekday] : [];
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Longest gap between offered start times, so a long service (surgery, tour) can still start every hour.
const MAX_SLOT_STEP_MINUTES = 60;

/**
 * Start times for one day. Inside each block the slots start at the block's opening time and step by the
 * service duration (at most one hour); a session must finish before its block closes, so it never spans a lunch break.
 */
export function daySlots(hours: BusinessHours, date: string, durationMinutes: number): string[] {
  if (durationMinutes <= 0) return [];

  const step = Math.min(durationMinutes, MAX_SLOT_STEP_MINUTES);
  const slots: string[] = [];
  for (const block of blocksForDate(hours, date)) {
    const open = toMinutes(block.start);
    const close = toMinutes(block.end);
    for (let current = open; current + durationMinutes <= close; current += step) {
      slots.push(toTime(current));
    }
  }
  return slots;
}

/** True when a session starting at `time` and lasting `durationMinutes` fits inside one block of that day. */
export function slotWithinHours(hours: BusinessHours, date: string, time: string, durationMinutes: number): boolean {
  if (!TIME_REGEX.test(time)) return false;

  const start = toMinutes(time);
  return blocksForDate(hours, date).some(
    (block) => start >= toMinutes(block.start) && start + durationMinutes <= toMinutes(block.end)
  );
}

/** Length in minutes of the longest single block in the week. A service longer than this can never be booked. */
export function longestBlockMinutes(hours: BusinessHours): number {
  let longest = 0;
  for (const weekday of WEEKDAYS) {
    for (const block of hours[weekday]) {
      longest = Math.max(longest, toMinutes(block.end) - toMinutes(block.start));
    }
  }
  return longest;
}

const SPANISH_DAY_NAMES: Record<Weekday, string> = {
  sunday: "domingo",
  monday: "lunes",
  tuesday: "martes",
  wednesday: "miércoles",
  thursday: "jueves",
  friday: "viernes",
  saturday: "sábado",
};

/** Plain-text schedule for the bot prompt, Monday first. */
export function formatBusinessHours(hours: BusinessHours): string {
  const order: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  return order
    .map((weekday) => {
      const blocks = hours[weekday];
      const text = blocks.length > 0 ? blocks.map((b) => `${b.start} a ${b.end}`).join(", ") : "cerrado";
      return `${SPANISH_DAY_NAMES[weekday]}: ${text}`;
    })
    .join("\n");
}

const CALENDAR_DAYS = 14;

function clinicDateKey(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/** Next days in the clinic zone with weekday, date and hours, so the bot never works out weekdays itself. */
export function upcomingCalendarText(hours: BusinessHours, now: Date = new Date()): string {
  const [y, m, d] = clinicDateKey(now).split("-").map(Number);
  const lines: string[] = [];
  for (let i = 0; i < CALENDAR_DAYS; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const key = day.toISOString().slice(0, 10);
    const weekday = WEEKDAYS[day.getUTCDay()];
    const blocks = hours[weekday];
    const label = `${SPANISH_DAY_NAMES[weekday]} ${day.getUTCDate()} de ${day.toLocaleDateString("es-MX", { timeZone: "UTC", month: "long" })}`;
    const hoursText = blocks.length > 0 ? blocks.map((b) => `${b.start} a ${b.end}`).join(", ") : "cerrado";
    lines.push(`- ${label} (${key}${i === 0 ? ", hoy" : i === 1 ? ", mañana" : ""}): ${hoursText}`);
  }
  return lines.join("\n");
}

const WEEK_ORDER: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** The week Monday first, one row per day, for showing the schedule to customers. An empty `blocks` means closed. */
export function weeklyScheduleRows(hours: BusinessHours): { weekday: Weekday; blocks: DayHours[] }[] {
  return WEEK_ORDER.map((weekday) => ({ weekday, blocks: hours[weekday] }));
}

/** Every start time of the day, each flagged free or not, so a screen can show taken times as disabled. */
export function markSlots(candidates: string[], available: string[]): { time: string; available: boolean }[] {
  const free = new Set(available);
  return candidates.map((time) => ({ time, available: free.has(time) }));
}
