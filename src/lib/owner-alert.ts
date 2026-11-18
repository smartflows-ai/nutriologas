// src/lib/owner-alert.ts
// Cooldown rule for the alert to the business owner when the WhatsApp bot could not answer a customer.
// Pure: the route reads the last alert time, decides here, sends, and writes the new time only if the send worked.

export const OWNER_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/** True when no alert was sent in the last cooldown window. */
export function shouldAlertOwner(now: Date, lastAlertedAt: Date | null): boolean {
  if (!lastAlertedAt) return true;
  return now.getTime() - lastAlertedAt.getTime() >= OWNER_ALERT_COOLDOWN_MS;
}
