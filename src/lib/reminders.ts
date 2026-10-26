// src/lib/reminders.ts
// Pure scheduling rules for appointment reminders and auto-release. No I/O.
// The reminder goes out `leadHours` before the visit, and the visit is released `deadlineHours` before it
// when the customer has not answered SI. The time between the two is the customer's window to confirm.
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Shortest window (minutes) in which a customer can realistically answer. Shorter windows count as confirmed. */
export const MIN_ANSWER_MINUTES = 30;

/** Instant when the visit is released if the customer did not confirm. */
export function releaseAt(apptStart: Date, deadlineHours: number): Date {
  return new Date(apptStart.getTime() - deadlineHours * HOUR_MS);
}

/** Instant when the reminder is due: `leadHours` before the visit. Exact time, even at night. */
export function reminderSendAt(apptStart: Date, leadHours: number): Date {
  return new Date(apptStart.getTime() - leadHours * HOUR_MS);
}

export interface ReminderPlan {
  /** Send the reminder with the confirmation request. */
  requestConfirmation: boolean;
  /** Send a plain reminder (no confirmation request, no release). */
  sendPlain: boolean;
  /** Time when the reminder is due. */
  sendAt: Date;
  /** Deadline after which the visit is released; null when no confirmation is requested. */
  releaseAt: Date | null;
}

/**
 * Decides what a visit gets.
 * - Confirmation on and the window (send to release) is at least MIN_ANSWER_MINUTES: request confirmation,
 *   release at the deadline if the customer does not answer SI.
 * - A visit booked after its reminder moment is due at once (its send time is the booking time).
 * - A visit booked late with no usable window counts as confirmed: nothing is sent, nothing is released.
 * - Otherwise, not booked late and at least MIN_ANSWER_MINUTES before the visit: plain reminder, no release.
 */
export function planReminder(input: {
  apptStart: Date;
  createdAt: Date;
  leadHours: number;
  deadlineHours: number;
  confirmationRequired: boolean;
}): ReminderPlan {
  const scheduled = reminderSendAt(input.apptStart, input.leadHours);
  const bookedLate = input.createdAt.getTime() > scheduled.getTime();
  const sendAt = bookedLate ? input.createdAt : scheduled;
  const deadline = releaseAt(input.apptStart, input.deadlineHours);
  const windowMs = deadline.getTime() - sendAt.getTime();

  if (input.confirmationRequired && windowMs >= MIN_ANSWER_MINUTES * MINUTE_MS) {
    return { requestConfirmation: true, sendPlain: false, sendAt, releaseAt: deadline };
  }

  // No usable window (or confirmation off). A visit just booked late is never reminded.
  if (bookedLate) return { requestConfirmation: false, sendPlain: false, sendAt, releaseAt: null };

  const timeLeftMs = input.apptStart.getTime() - sendAt.getTime();
  const sendPlain = timeLeftMs >= MIN_ANSWER_MINUTES * MINUTE_MS;
  return { requestConfirmation: false, sendPlain, sendAt, releaseAt: null };
}
