// src/lib/reminder-badge.ts
// Decides whether the CRM flags a visit as "reminder not delivered". Calendar-only events carry none of these
// fields, so they never show it.

interface ReminderBadgeInput {
  status: string;
  reminderSentAt?: string | Date | null;
  reminderAttempts?: number | null;
  appointmentDate?: string | Date | null;
}

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

/**
 * True when the job tried to send the reminder, failed, and has not delivered it yet.
 * Once the visit time has passed the job no longer retries, so the flag is dropped.
 */
export function reminderNotDelivered(visit: ReminderBadgeInput, now: Date = new Date()): boolean {
  const isPast = visit.appointmentDate != null && new Date(visit.appointmentDate).getTime() <= now.getTime();
  return !isPast && ACTIVE_STATUSES.includes(visit.status) && !visit.reminderSentAt && (visit.reminderAttempts ?? 0) > 0;
}
