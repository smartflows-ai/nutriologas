// src/lib/messaging/policy.ts
// Ban prevention: one pure decision for every outbound WhatsApp message. No I/O. Tests: tests/messaging-policy.test.ts.
// Order matters: kill switches and risk states first, then opt-out, consent, quiet hours.
// These are operational safeguards; they reduce preventable risk and never guarantee that WhatsApp will not restrict a number.

export type MessagePurpose = "CUSTOMER_REPLY" | "TRANSACTIONAL" | "INTERNAL" | "MARKETING";
export type RiskState =
  | "NORMAL"
  | "OBSERVATION"
  | "DEGRADED"
  | "SENDING_PAUSED"
  | "REQUIRES_MANUAL_REVIEW"
  | "SUSPENDED";
export type PolicyMode = "SHADOW" | "ENFORCE";
export type ConsentState = "YES" | "NO" | "GRANDFATHERED";

export type PolicyInput = {
  purpose: MessagePurpose;
  /** Any of the three switches on stops every message, whatever the purpose. */
  killSwitch: { global: boolean; tenant: boolean; instance: boolean };
  riskState: RiskState;
  optedOut: boolean;
  consent: ConsentState;
  mode: PolicyMode;
  /** True when the time now is inside quiet hours for the business. */
  quietHours: boolean;
  /** Urgent messages (a same-day cancellation the customer must know) are not held for quiet hours. */
  urgent: boolean;
  /** True when the recipient is one of the business's own numbers (owner or staff). */
  recipientIsTeam: boolean;
};

export type PolicyDecision =
  | "ALLOWED"
  | "DEFER_QUIET_HOURS"
  | "BLOCKED_KILL_SWITCH"
  | "BLOCKED_RISK_STATE"
  | "BLOCKED_OPT_OUT"
  | "BLOCKED_NO_CONSENT"
  | "BLOCKED_MARKETING"
  | "BLOCKED_NOT_TEAM";

export type PolicyResult = {
  decision: PolicyDecision;
  /** In SHADOW mode a consent block is measured, not enforced: the message still goes out. */
  wouldBlock: boolean;
  /** True when the decision stops the message (after applying the mode). */
  stopped: boolean;
};

const RISK_BLOCKS_ALL = new Set<RiskState>(["SENDING_PAUSED", "REQUIRES_MANUAL_REVIEW", "SUSPENDED"]);

export function decide(input: PolicyInput): PolicyResult {
  const result = (decision: PolicyDecision, enforcedBlock: boolean): PolicyResult => {
    const stopped = enforcedBlock && decision !== "ALLOWED";
    return { decision, wouldBlock: decision !== "ALLOWED" && decision !== "DEFER_QUIET_HOURS", stopped };
  };

  if (input.killSwitch.global || input.killSwitch.tenant || input.killSwitch.instance) {
    return result("BLOCKED_KILL_SWITCH", true);
  }
  if (RISK_BLOCKS_ALL.has(input.riskState)) return result("BLOCKED_RISK_STATE", true);

  if (input.purpose === "MARKETING") return result("BLOCKED_MARKETING", true);

  if (input.purpose === "INTERNAL") {
    // Team notices go only to the business's own numbers, and do not need customer consent.
    return input.recipientIsTeam ? result("ALLOWED", true) : result("BLOCKED_NOT_TEAM", true);
  }

  // Replies inside a conversation the customer started: only the switches, the risk state and opt-out apply.
  if (input.optedOut) return result("BLOCKED_OPT_OUT", true);
  if (input.purpose === "CUSTOMER_REPLY") return result("ALLOWED", true);

  // TRANSACTIONAL: messages about a visit.
  if (input.consent === "NO") {
    // Measured in SHADOW, enforced in ENFORCE.
    const enforced = input.mode === "ENFORCE";
    return { decision: "BLOCKED_NO_CONSENT", wouldBlock: true, stopped: enforced };
  }
  if (input.quietHours && !input.urgent) return { decision: "DEFER_QUIET_HOURS", wouldBlock: false, stopped: false };
  return result("ALLOWED", true);
}
