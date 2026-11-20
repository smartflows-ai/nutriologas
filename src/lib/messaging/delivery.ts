// src/lib/messaging/delivery.ts
// Ban prevention: what happens after a send attempt. Pure rules, no I/O. Tests: tests/messaging-delivery.test.ts.
// - Idempotency: a message sent once is never sent again; a message whose outcome is unknown is never resent blindly.
// - Error classes: which failures are retried, which are a possible restriction (they stop the instance).
// - Circuit breaker: after repeated failures, or one restriction-like error, the instance stops sending until a person resumes it.

export type OutboxStatus = "QUEUED" | "SENT" | "FAILED" | "UNKNOWN" | "BLOCKED";

/** Can this row be attempted now? UNKNOWN and SENT never are. FAILED only while attempts remain. */
export function canAttempt(row: { status: OutboxStatus; attempts: number; maxAttempts: number }): boolean {
  if (row.status === "QUEUED") return true;
  if (row.status === "FAILED") return row.attempts < row.maxAttempts;
  return false;
}

export type AttemptError =
  | { kind: "network" }
  | { kind: "timeout"; requestLeft: boolean }
  | { kind: "server"; status: number }
  | { kind: "client"; status: number }
  | { kind: "auth"; status: number }
  | { kind: "logged_out" };

/** A failure that proves the message did not leave: safe to retry later. */
export function isRetryable(error: AttemptError): boolean {
  if (error.kind === "network") return true;
  if (error.kind === "server") return error.status >= 500;
  if (error.kind === "timeout") return !error.requestLeft;
  return false;
}

/** The outcome of a failed attempt, as stored on the row. A timeout after the request left is UNKNOWN, never FAILED. */
export function statusAfterFailure(error: AttemptError): OutboxStatus {
  if (error.kind === "timeout" && error.requestLeft) return "UNKNOWN";
  return "FAILED";
}

/** Auth errors and a logged-out session are the signs that should stop sending, not retry. */
export function isRestrictionSignal(error: AttemptError): boolean {
  return error.kind === "auth" || error.kind === "logged_out";
}

export type BreakerState = { consecutiveFailures: number; open: boolean; reason: string | null };

export const BREAKER_THRESHOLD = 5;

export function initialBreaker(): BreakerState {
  return { consecutiveFailures: 0, open: false, reason: null };
}

export function breakerAfterSuccess(state: BreakerState): BreakerState {
  return state.open ? state : { ...state, consecutiveFailures: 0 };
}

export function breakerAfterFailure(state: BreakerState, error: AttemptError, threshold = BREAKER_THRESHOLD): BreakerState {
  if (state.open) return state;
  if (isRestrictionSignal(error)) {
    return { consecutiveFailures: state.consecutiveFailures + 1, open: true, reason: error.kind };
  }
  const failures = state.consecutiveFailures + 1;
  return failures >= threshold
    ? { consecutiveFailures: failures, open: true, reason: "consecutive_failures" }
    : { ...state, consecutiveFailures: failures };
}

/** Only a person resumes an open breaker, after reviewing the cause. Nothing resumes it automatically. */
export function resumeByPerson(state: BreakerState, reviewedBy: string | null): BreakerState {
  if (!reviewedBy) return state;
  return initialBreaker();
}

export type KillSwitchScope = "GLOBAL" | "TENANT" | "INSTANCE" | null;

/** The widest switch that is on decides the scope shown to the owner and in the logs. */
export function activeKillSwitch(input: { global: boolean; tenant: boolean; instance: boolean }): KillSwitchScope {
  if (input.global) return "GLOBAL";
  if (input.tenant) return "TENANT";
  if (input.instance) return "INSTANCE";
  return null;
}
