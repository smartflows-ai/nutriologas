// src/lib/messaging/connection.ts
// Ban prevention: what a connection event from Evolution means for sending. Pure rules, no I/O.
// Tests: tests/messaging-connection.test.ts.
//
// A logout (401) or a forbidden (403) on close is a POSSIBLE restriction, never a confirmed ban: the instance stops
// sending and a person decides what to do. Any other close is a plain disconnection: the sends fail on their own and
// nothing is paused. An open event only records the connection time; it never resumes a paused instance.

export type ConnectionEvent = {
  state: "open" | "connecting" | "close";
  /** The disconnection code Baileys reports on close (401 = logged out, 403 = forbidden), when present. */
  statusCode?: number | null;
};

export type ConnectionEffect =
  | { kind: "connected" }
  | { kind: "disconnected"; reason: string }
  | { kind: "possible_restriction"; reason: string }
  | { kind: "ignored" };

/** Codes that mean the provider refused or ended the session: treated as a possible restriction. */
const RESTRICTION_CODES = new Set([401, 403]);

export function connectionEffectOf(event: ConnectionEvent): ConnectionEffect {
  if (event.state === "open") return { kind: "connected" };
  if (event.state === "connecting") return { kind: "ignored" };
  const code = event.statusCode ?? null;
  if (code !== null && RESTRICTION_CODES.has(code)) {
    return { kind: "possible_restriction", reason: `possible_restriction:${code}` };
  }
  return { kind: "disconnected", reason: code === null ? "disconnected" : `disconnected:${code}` };
}

/** The fields to write for an effect. An open event never clears a pause: only a person does (see resume). */
export function connectionPatchOf(effect: ConnectionEffect, now: Date): Record<string, unknown> {
  switch (effect.kind) {
    case "connected":
      return { lastConnectedAt: now };
    case "disconnected":
      return { lastDisconnectedAt: now, statusReason: effect.reason };
    case "possible_restriction":
      return {
        lastDisconnectedAt: now,
        riskState: "SENDING_PAUSED",
        sendingPausedAt: now,
        statusReason: effect.reason,
      };
    case "ignored":
      return {};
  }
}

/** The resume action: only after a person reviewed the cause. Clears the pause and the failure count. */
export function resumePatch(reviewedBy: string | null): Record<string, unknown> | null {
  if (!reviewedBy) return null;
  return { riskState: "NORMAL", sendingPausedAt: null, consecutiveFailures: 0, statusReason: null };
}
