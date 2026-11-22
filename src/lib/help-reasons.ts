// src/lib/help-reasons.ts
// Why a WhatsApp chat needs a person (HITL). One registry: the priority of each reason lives here, so a new reason
// is added here and not in the screen or the routes. Pure, no I/O.

export const HELP_PRIORITY = { NONE: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
export type HelpPriority = (typeof HELP_PRIORITY)[keyof typeof HELP_PRIORITY];

export type HelpReason =
  | "purchase_intent"
  | "person_requested"
  | "send_failed"
  | "agent_failed"
  | "unanswered"
  | "unanswered_long"
  | "credits_exhausted"
  | "online_link_missing"
  | "tool_loop"
  | "reminder_failed"
  | "urgency"
  | "opted_out"
  | "booking_limit";

interface HelpReasonInfo {
  readonly priority: HelpPriority;
  /** Key of the label in the dictionaries (t.crm.whatsapp.help.reason.<labelKey>). */
  readonly labelKey: string;
  /** The bot stops answering this contact: a person has to take over the conversation. */
  readonly pausesBot: boolean;
  /** The reason hits the whole business (a send failure, credits): one notice per hour, not one per chat. */
  readonly tenantWide: boolean;
  /** Version 1 turns on the reasons that already have a clear signal; the rest wait for a later release. */
  readonly enabled: boolean;
}

export const HELP_REASONS: Readonly<Record<HelpReason, HelpReasonInfo>> = {
  purchase_intent: { priority: HELP_PRIORITY.MEDIUM, labelKey: "purchase", enabled: true, pausesBot: true, tenantWide: false },
  person_requested: { priority: HELP_PRIORITY.HIGH, labelKey: "person", enabled: true, pausesBot: true, tenantWide: false },
  send_failed: { priority: HELP_PRIORITY.HIGH, labelKey: "sendFailed", enabled: true, pausesBot: false, tenantWide: true },
  agent_failed: { priority: HELP_PRIORITY.HIGH, labelKey: "agentFailed", enabled: true, pausesBot: false, tenantWide: true },
  unanswered: { priority: HELP_PRIORITY.MEDIUM, labelKey: "unanswered", enabled: true, pausesBot: false, tenantWide: false },
  unanswered_long: { priority: HELP_PRIORITY.HIGH, labelKey: "unanswered", enabled: true, pausesBot: false, tenantWide: false },
  credits_exhausted: { priority: HELP_PRIORITY.HIGH, labelKey: "credits", enabled: true, pausesBot: false, tenantWide: true },
  online_link_missing: { priority: HELP_PRIORITY.MEDIUM, labelKey: "onlineLink", enabled: true, pausesBot: false, tenantWide: false },
  tool_loop: { priority: HELP_PRIORITY.MEDIUM, labelKey: "toolLoop", enabled: false, pausesBot: false, tenantWide: false },
  reminder_failed: { priority: HELP_PRIORITY.MEDIUM, labelKey: "reminderFailed", enabled: false, pausesBot: false, tenantWide: false },
  urgency: { priority: HELP_PRIORITY.CRITICAL, labelKey: "urgency", enabled: false, pausesBot: true, tenantWide: false },
  // The patient asked to stop messages (wa-optout.ts). The sync route already turns the bot off with its own pause
  // reason, so this reason does not count as a hand-off pause: marking the chat handled keeps the bot off. Only
  // "Reactivar mensajes" (after a person confirms with the patient) lifts it.
  opted_out: { priority: HELP_PRIORITY.MEDIUM, labelKey: "optedOut", enabled: true, pausesBot: false, tenantWide: false },
  // A person asked for more visits in one day than the limit (booking-limit.ts, #141): the server raises it from bot/book
  // and bot/reschedule, and a person decides, so the bot steps aside.
  booking_limit: { priority: HELP_PRIORITY.MEDIUM, labelKey: "bookingLimit", enabled: true, pausesBot: true, tenantWide: false },
};

export function isHelpReason(value: unknown): value is HelpReason {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(HELP_REASONS, value);
}

export function priorityOf(reason: HelpReason): HelpPriority {
  return HELP_REASONS[reason].priority;
}

export function isReasonEnabled(reason: HelpReason): boolean {
  return HELP_REASONS[reason].enabled;
}

export function pausesBot(reason: HelpReason): boolean {
  return HELP_REASONS[reason].pausesBot;
}

export function isTenantWide(reason: HelpReason): boolean {
  return HELP_REASONS[reason].tenantWide;
}
