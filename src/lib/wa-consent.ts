// src/lib/wa-consent.ts
// Pure decision: may the business START a WhatsApp message to a customer (reminder, confirmation request,
// cancellation, owner confirmation)? No I/O. Tests: tests/wa-consent.test.ts.
//
// Strict consent (owner's requirement): holding a phone number is not consent. A reminder goes out only to a
// customer who gave verifiable consent for this visit, and never to one who opted out.
// SHADOW mode lets us measure how many sends consent WOULD block before turning the block on per tenant.

export type MessagingPolicyMode = "SHADOW" | "ENFORCE";

export type ConsentSource =
  | "WHATSAPP_BOOKING" // the patient wrote and booked with the bot
  | "WEB_CHECKBOX" // ticked the box on /agendar
  | "PANEL_STAFF" // staff recorded the patient's agreement when booking
  | "WHATSAPP_INBOUND"; // the patient wrote first (e.g. "Confirmar por WhatsApp")

export type ConsentDecisionReason = "opted_out" | "consent" | "grandfathered" | "no_consent";

export interface ConsentDecision {
  /** Whether the message may be sent now. */
  allowed: boolean;
  reason: ConsentDecisionReason;
  /** True when SHADOW mode allowed a send that ENFORCE mode would have blocked (for measuring, not blocking). */
  shadow: boolean;
}

export function mayStartMessage(input: {
  optedOutAt: Date | null;
  consentAt: Date | null;
  createdAt: Date;
  /** When this tenant switched to ENFORCE; visits created before it are grandfathered. Null = nothing grandfathered. */
  enforcedAt: Date | null;
  mode: MessagingPolicyMode;
}): ConsentDecision {
  // Opt-out is a hard rule: it blocks in both modes.
  if (input.optedOutAt) return { allowed: false, reason: "opted_out", shadow: false };

  if (input.consentAt) return { allowed: true, reason: "consent", shadow: false };

  const grandfathered = input.enforcedAt !== null && input.createdAt.getTime() < input.enforcedAt.getTime();
  if (grandfathered) return { allowed: true, reason: "grandfathered", shadow: false };

  // No consent and not grandfathered.
  if (input.mode === "ENFORCE") return { allowed: false, reason: "no_consent", shadow: false };
  return { allowed: true, reason: "no_consent", shadow: true };
}
