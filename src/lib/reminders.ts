// src/lib/reminders.ts
// Pure scheduling rules for appointment reminders and auto-release. No I/O.
import { clinicDateTime } from "@/lib/clinic-time";

export type ReminderMode = "DAY_BEFORE" | "SAME_DAY";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Clinic calendar date (YYYY-MM-DD) of an instant. */
function clinicDateKey(instant: Date): string {
  return instant.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/** Instant when the reminder goes out: at sendTime on the visit day, or the day before. */
export function reminderSendAt(apptStart: Date, mode: ReminderMode, sendTime: string): Date {
  // Mexico City has no DST, so a 24 h step keeps the same clinic clock time.
  const day = mode === "DAY_BEFORE" ? clinicDateKey(new Date(apptStart.getTime() - DAY_MS)) : clinicDateKey(apptStart);
  return new Date(clinicDateTime(day, sendTime));
}

/** Instant after which an unconfirmed visit is released. */
export function releaseAt(apptStart: Date, deadlineHours: number): Date {
  return new Date(apptStart.getTime() - deadlineHours * HOUR_MS);
}

export interface ReminderPlan {
  /** Send the reminder with the confirmation request. */
  requestConfirmation: boolean;
  /** Send a plain reminder (no confirmation request). */
  sendPlain: boolean;
  /** Time when the reminder is due. */
  sendAt: Date;
  /** Deadline after which the visit is released; null when no confirmation is requested. */
  releaseAt: Date | null;
}

/**
 * Decides what a visit gets. A visit booked after its reminder time, or whose release deadline
 * is already at or before the reminder time, counts as confirmed: no request, no auto-release.
 */
export function planReminder(input: {
  apptStart: Date;
  createdAt: Date;
  mode: ReminderMode;
  sendTime: string;
  confirmationRequired: boolean;
  deadlineHours: number;
}): ReminderPlan {
  const sendAt = reminderSendAt(input.apptStart, input.mode, input.sendTime);
  const deadline = releaseAt(input.apptStart, input.deadlineHours);
  const bookedLate = input.createdAt.getTime() > sendAt.getTime();
  const noTimeToAnswer = deadline.getTime() <= sendAt.getTime();

  if (bookedLate) {
    return { requestConfirmation: false, sendPlain: false, sendAt, releaseAt: null };
  }
  if (!input.confirmationRequired || noTimeToAnswer) {
    return { requestConfirmation: false, sendPlain: true, sendAt, releaseAt: null };
  }
  return { requestConfirmation: true, sendPlain: false, sendAt, releaseAt: deadline };
}
