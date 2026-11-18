// src/lib/help-routing.ts
// Who is told first about a chat that needs a person, and when the owner is told next. Pure, no I/O.
// Order: the assistant assigned to the chat; else the queue (fewest open requests, then longest without a notice);
// else the owner. The owner is always the last level.

export interface Assistant {
  readonly id: string;
  readonly active: boolean;
  /** WhatsApp number the notice goes to; an assistant without one cannot be told. */
  readonly whatsappNumber: string | null;
  /** Chats with help still open that are assigned to this assistant. */
  readonly openCount: number;
  /** When this assistant was last notified about any chat. */
  readonly lastNotifiedAt: Date | null;
}

export type Responder =
  | { readonly kind: "assistant"; readonly id: string; readonly source: "assigned" | "queue" }
  | { readonly kind: "owner" };

function canReceive(assistant: Assistant): boolean {
  return assistant.active && !!assistant.whatsappNumber && assistant.whatsappNumber.trim() !== "";
}

function notifiedAtMs(assistant: Assistant): number {
  return assistant.lastNotifiedAt ? assistant.lastNotifiedAt.getTime() : Number.NEGATIVE_INFINITY;
}

export function pickFirstResponder(input: { assignedToId: string | null; assistants: readonly Assistant[] }): Responder {
  const able = input.assistants.filter(canReceive);
  const assigned = input.assignedToId ? able.find((a) => a.id === input.assignedToId) : undefined;
  if (assigned) return { kind: "assistant", id: assigned.id, source: "assigned" };
  const queue = [...able].sort(
    (a, b) => a.openCount - b.openCount || notifiedAtMs(a) - notifiedAtMs(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const first = queue[0];
  return first ? { kind: "assistant", id: first.id, source: "queue" } : { kind: "owner" };
}

export interface HelpNotifyPlan {
  /** The assistant to tell now, or null. */
  readonly assistantId: string | null;
  /** The owner is told now only when there is no assistant to tell first. */
  readonly notifyOwner: boolean;
}

export function helpNotifyPlan(input: { notify: boolean; responder: Responder }): HelpNotifyPlan {
  if (!input.notify) return { assistantId: null, notifyOwner: false };
  if (input.responder.kind === "assistant") return { assistantId: input.responder.id, notifyOwner: false };
  return { assistantId: null, notifyOwner: true };
}

export interface EscalationState {
  readonly assigneeNotifiedAt: Date | null;
  readonly ownerNotifiedAt: Date | null;
  readonly takenAt: Date | null;
}

const MS_PER_MINUTE = 60 * 1000;

/** The assistant was told, nobody took the chat, the owner was not told yet, and the configured time has passed. */
export function escalationDue(now: Date, state: EscalationState, minutes: number): boolean {
  if (state.takenAt || state.ownerNotifiedAt || !state.assigneeNotifiedAt) return false;
  return now.getTime() - state.assigneeNotifiedAt.getTime() >= minutes * MS_PER_MINUTE;
}

/** Minutes before the owner is told: 15 to 240 in steps of 15 (the reminder job runs every 15 minutes). */
export const ESCALATION_MIN_MINUTES = 15;
export const ESCALATION_MAX_MINUTES = 240;
export const ESCALATION_STEP_MINUTES = 15;

export function isValidEscalationMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= ESCALATION_MIN_MINUTES &&
    value <= ESCALATION_MAX_MINUTES &&
    value % ESCALATION_STEP_MINUTES === 0
  );
}

/** Minutes after the owner's assignment before the assistant gets a WhatsApp reminder, if nobody took the chat. One job run. */
export const ASSIGNMENT_REMINDER_MINUTES = 15;

export interface AssignmentState extends EscalationState {
  readonly assignedToId: string | null;
  readonly helpPriority: number;
  readonly helpAssignedAt: Date | null;
}

/**
 * The owner put an assistant in charge of a chat that needs help, nobody took it, the assistant was not sent a WhatsApp
 * reminder since the assignment, the owner was not told yet, and the wait has passed. The in-app notice comes at once;
 * this is the WhatsApp that follows it.
 */
export function assignmentReminderDue(now: Date, state: AssignmentState, minutes: number = ASSIGNMENT_REMINDER_MINUTES): boolean {
  if (!state.assignedToId || !state.helpAssignedAt || state.helpPriority <= 0) return false;
  if (state.takenAt || state.ownerNotifiedAt) return false;
  if (state.assigneeNotifiedAt && state.assigneeNotifiedAt.getTime() >= state.helpAssignedAt.getTime()) return false;
  return now.getTime() - state.helpAssignedAt.getTime() >= minutes * MS_PER_MINUTE;
}
