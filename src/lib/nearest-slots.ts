// src/lib/nearest-slots.ts
// When a time is taken a second earlier, every reply offers the nearest free times instead of a bare
// "not available" (ticket #103, D10). Pure function, no I/O: free-slots.ts loads the free times.

/** A clinic day (YYYY-MM-DD) and time (HH:mm), Mexico City time. */
export interface SlotRef {
  readonly date: string;
  readonly time: string;
}

export const ALTERNATIVES_OFFERED = 3;

function minutesOf(slot: SlotRef): number {
  const [y, m, d] = slot.date.split("-").map(Number);
  const [h, min] = slot.time.split(":").map(Number);
  return Date.UTC(y, m - 1, d) / 60000 + h * 60 + min;
}

/**
 * The `limit` free times closest to the wanted one (the wanted time itself excluded), earlier first on a tie,
 * returned in time order. The input is not changed.
 */
export function nearestSlots(free: readonly SlotRef[], target: SlotRef, limit: number = ALTERNATIVES_OFFERED): SlotRef[] {
  const wanted = minutesOf(target);
  return free
    .map((slot) => ({ slot, at: minutesOf(slot) }))
    .filter(({ at }) => at !== wanted)
    .sort((a, b) => Math.abs(a.at - wanted) - Math.abs(b.at - wanted) || a.at - b.at)
    .slice(0, Math.max(0, limit))
    .sort((a, b) => a.at - b.at)
    .map(({ slot }) => ({ date: slot.date, time: slot.time }));
}
