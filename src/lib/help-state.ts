// src/lib/help-state.ts
// A chat's help state. It opens with a reason, goes up in priority, never goes down, and is cleared when somebody
// handles it. Pure: each call returns a new object, the I/O code only hands it to Prisma.
import { HELP_PRIORITY, isReasonEnabled, priorityOf, type HelpReason } from "@/lib/help-reasons";

export interface HelpState {
  readonly reason: HelpReason | null;
  readonly priority: number;
  readonly requestedAt: Date | null;
}

export const NO_HELP: HelpState = { reason: null, priority: HELP_PRIORITY.NONE, requestedAt: null };

export interface RaiseResult {
  readonly state: HelpState;
  /** True when the responder must be told: a new request, or one that went up in priority. */
  readonly notify: boolean;
}

export function raiseHelp(state: HelpState, reason: HelpReason, now: Date): RaiseResult {
  if (!isReasonEnabled(reason)) return { state, notify: false };
  const priority = priorityOf(reason);
  if (state.priority === HELP_PRIORITY.NONE) {
    return { state: { reason, priority, requestedAt: now }, notify: true };
  }
  if (priority > state.priority) {
    return { state: { reason, priority, requestedAt: state.requestedAt }, notify: true };
  }
  return { state, notify: false };
}

export function resolveHelp(_state: HelpState): HelpState {
  return NO_HELP;
}

const MS_PER_MINUTE = 60 * 1000;

/**
 * The customer's last message has no reply. Medium once it waits `minutes`, high once it waits twice as long,
 * and nothing before that.
 */
export function unansweredReason(now: Date, lastInboundAt: Date, minutes: number): "unanswered" | "unanswered_long" | null {
  const waited = now.getTime() - lastInboundAt.getTime();
  if (waited >= 2 * minutes * MS_PER_MINUTE) return "unanswered_long";
  if (waited >= minutes * MS_PER_MINUTE) return "unanswered";
  return null;
}
