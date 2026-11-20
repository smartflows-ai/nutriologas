// src/lib/wa-pacing.ts
// Pure pacing rules for messages WE start (reminders, releases): quiet hours and a per-instance per-run cap.
// No I/O. Tests: tests/wa-pacing.test.ts.
//
// These reduce two ban signals: sending at night, and sending many messages in a burst. They are operational
// safeguards, not a guarantee against WhatsApp enforcement.

const MINUTES_PER_DAY = 24 * 60;

/** Default quiet window: 21:00 to 08:00 business time. */
export const DEFAULT_QUIET_START_MIN = 21 * 60;
export const DEFAULT_QUIET_END_MIN = 8 * 60;

/** Smallest window after quiet hours end that still makes a reminder worth holding for. */
export const MIN_WINDOW_AFTER_QUIET_MIN = 30;

/** At most this many messages we start, per WhatsApp instance, per 15-minute run. The rest wait for the next run. */
export const MAX_SENDS_PER_INSTANCE_PER_RUN = 3;

/** Minutes since local midnight for a business "HH:MM" clock string (from clinicTimeOf). */
export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h % 24) * 60 + (m % 60);
}

/** Is a local time inside the quiet window? Start is inclusive, end exclusive; the window may wrap midnight. */
export function isWithinQuietHours(localMin: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false; // empty window
  if (startMin < endMin) return localMin >= startMin && localMin < endMin;
  // wraps midnight
  return localMin >= startMin || localMin < endMin;
}

/** Minutes from a local time to the end of the quiet window (0 when not inside it). */
export function minutesUntilQuietEnd(localMin: number, startMin: number, endMin: number): number {
  if (!isWithinQuietHours(localMin, startMin, endMin)) return 0;
  const diff = endMin - localMin;
  return diff > 0 ? diff : diff + MINUTES_PER_DAY;
}

/**
 * Hold a due reminder until the quiet window ends, but only when the visit is far enough that a usable window
 * still remains afterwards. If the visit is too soon, send now rather than never.
 * When the reminder asks to confirm, the limit is the confirmation deadline, not the visit: a reminder that would
 * arrive after its deadline gets the visit released minutes later (QA 2026-11-20), so it goes out now instead.
 */
export function shouldHoldForQuietHours(input: {
  localMin: number;
  minutesUntilAppt: number;
  /** Minutes until the visit is released when it asks to confirm; omitted when it does not ask. */
  minutesUntilDeadline?: number | null;
  quietStartMin: number;
  quietEndMin: number;
}): boolean {
  if (!isWithinQuietHours(input.localMin, input.quietStartMin, input.quietEndMin)) return false;
  const untilEnd = minutesUntilQuietEnd(input.localMin, input.quietStartMin, input.quietEndMin);
  const limit = input.minutesUntilDeadline ?? input.minutesUntilAppt;
  return limit > untilEnd + MIN_WINDOW_AFTER_QUIET_MIN;
}

/** Whether another send is allowed for an instance that has already sent `sentSoFar` this run. */
export function underSendCap(sentSoFar: number, cap: number = MAX_SENDS_PER_INSTANCE_PER_RUN): boolean {
  return sentSoFar < cap;
}
