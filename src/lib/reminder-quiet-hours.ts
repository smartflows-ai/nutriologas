// src/lib/reminder-quiet-hours.ts
// Would a reminder go out inside the quiet hours? With the business's weekly hours and the reminder lead, every
// visit time maps to one reminder clock time. Pure, no I/O, safe for the browser (the reminders card) and the server
// (PATCH /api/tenants/reminders). Tests: tests/reminder-quiet-hours.test.ts.
import { WEEKDAYS, type BusinessHours } from "./business-hours";
import { isWithinQuietHours, minutesOfDay } from "./wa-pacing";

const MINUTES_PER_DAY = 24 * 60;

export interface ReminderQuietConflict {
  /** Visit start, minutes since local midnight. */
  readonly visitMin: number;
  /** When its reminder would go out, minutes since local midnight. */
  readonly reminderMin: number;
}

/**
 * The earliest visit time (across the week) whose reminder would land inside the quiet window, or null when none
 * does. A visit can start at any minute of a block, from its start up to (not including) its end. An empty quiet
 * window (start equals end) or a closed week never conflicts.
 */
export function reminderQuietConflict(
  hours: BusinessHours,
  leadMinutes: number,
  quietStartMin: number,
  quietEndMin: number,
): ReminderQuietConflict | null {
  if (quietStartMin === quietEndMin) return null;
  let first: ReminderQuietConflict | null = null;
  for (const day of WEEKDAYS) {
    for (const block of hours[day] ?? []) {
      const start = minutesOfDay(block.start);
      const end = minutesOfDay(block.end);
      for (let visit = start; visit < end; visit++) {
        const reminder = (((visit - leadMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
        if (!isWithinQuietHours(reminder, quietStartMin, quietEndMin)) continue;
        if (!first || visit < first.visitMin) first = { visitMin: visit, reminderMin: reminder };
        break; // later minutes of this block cannot be earlier than this one
      }
    }
  }
  return first;
}

/** "HH:MM" for minutes since local midnight (for the error message). */
export function clockOf(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
