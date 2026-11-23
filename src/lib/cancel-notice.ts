// src/lib/cancel-notice.ts
// Ticket #161: which text the patient gets when a visit is cancelled depends on who cancels. The text saved as
// Tenant.cancellationTemplate (and its default) says the visit was released "por falta de confirmación": it belongs
// only to the automatic release. A cancellation by the business (panel) or by the patient (Mis citas) gets a neutral
// text that gives no reason and does not say who cancelled. Pure rule, no I/O.
import { cancellationText, customerTexts, renderTemplate, type ReminderValues } from "@/lib/reminder-messages";

/** Who cancelled the visit. */
export type CancelOrigin =
  | "panel" // the business, from /admin/citas
  | "patient" // the patient, from Mis citas
  | "auto_release" // the reminders job, for lack of confirmation
  | "confirmations_release" // "Liberar ahora" in the Confirmaciones tab (the same release)
  | "bot"; // the patient asked the bot: the agent answers in the chat itself

export type CancelNoticeKind = "neutral" | "release" | "none";

export function cancelNoticeKind(origin: CancelOrigin): CancelNoticeKind {
  switch (origin) {
    case "panel":
    case "patient":
      return "neutral";
    case "auto_release":
    case "confirmations_release":
      return "release";
    case "bot":
      return "none";
  }
}

/**
 * The text to send, or null when the app sends none. The business's stored text is only read for a release; the
 * neutral text comes from the language dictionary and never changes what a business saved.
 */
export function cancelNoticeText(
  origin: CancelOrigin,
  stored: string | null | undefined,
  values: ReminderValues,
  language: string,
  onFallback?: (problem: string) => void,
): string | null {
  const kind = cancelNoticeKind(origin);
  if (kind === "none") return null;
  if (kind === "release") return cancellationText(stored, values, language, onFallback);
  return renderTemplate(customerTexts(language).cancelledNoticeTemplate, values);
}
