// src/lib/help-view.ts
// How a chat that needs help is shown in the CRM. Pure: the screen only reads these answers.
import { HELP_PRIORITY, HELP_REASONS, isHelpReason } from "@/lib/help-reasons";

export type HelpTone = "none" | "medium" | "high";

export function helpTone(priority: number | null | undefined): HelpTone {
  if (!priority || priority <= HELP_PRIORITY.NONE) return "none";
  return priority >= HELP_PRIORITY.HIGH ? "high" : "medium";
}

export function needsHelp(chat: { helpPriority?: number | null }): boolean {
  return helpTone(chat.helpPriority) !== "none";
}

export function reasonLabelKey(reason: string | null | undefined): string | null {
  return isHelpReason(reason) ? HELP_REASONS[reason].labelKey : null;
}

export interface Waiting {
  value: number;
  unit: "minutes" | "hours";
}

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;

/** How long a request has been waiting: minutes below an hour, whole hours after. Never negative. */
export function waitingParts(now: Date, since: Date | string | null | undefined): Waiting | null {
  if (!since) return null;
  const start = since instanceof Date ? since : new Date(since);
  if (Number.isNaN(start.getTime())) return null;
  const minutes = Math.max(0, Math.floor((now.getTime() - start.getTime()) / MS_PER_MINUTE));
  return minutes < MINUTES_PER_HOUR
    ? { value: minutes, unit: "minutes" }
    : { value: Math.floor(minutes / MINUTES_PER_HOUR), unit: "hours" };
}

/** An assignment older than this is not announced again (the toast is for a person who is looking at the panel now). */
export const ASSIGNMENT_NOTICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface AssignmentView {
  id: string;
  /** The customer's WhatsApp name, or the last digits of the number. Never the message. */
  contact: string;
  reason: string | null;
  priority: number;
  assignedAt: string;
  /** "assigned": an assistant was put in charge. "unattended": no assistant could take it, so the owner does. */
  kind?: "assigned" | "unattended";
}

/** The key of one assignment: the same chat assigned again is a new notice. */
export function assignmentKey(item: Pick<AssignmentView, "id" | "assignedAt">): string {
  return `${item.id}:${item.assignedAt}`;
}

/** Assignments the person has not been told about yet, oldest first. */
export function newAssignments(items: readonly AssignmentView[], seen: ReadonlySet<string>, now: Date): AssignmentView[] {
  return items
    .filter((item) => {
      const at = new Date(item.assignedAt).getTime();
      return !Number.isNaN(at) && now.getTime() - at <= ASSIGNMENT_NOTICE_WINDOW_MS && !seen.has(assignmentKey(item));
    })
    .sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime());
}

/** How a chat is named in a notice: the WhatsApp name when there is one, else the last four digits of the number. */
export function contactLabel(pushName: string | null | undefined, remoteJid: string): string {
  const name = (pushName ?? "").trim();
  if (name) return name;
  const digits = remoteJid.split("@")[0].replace(/\D/g, "");
  return digits.length >= 4 ? `···${digits.slice(-4)}` : "···";
}

/** The customer wrote again while the chat still needs a person and nobody has taken it yet. */
export function customerWroteAgain(chat: { helpPriority?: number | null; helpTakenAt?: string | Date | null; helpCustomerWroteAt?: string | Date | null }): boolean {
  return needsHelp(chat) && !chat.helpTakenAt && !!chat.helpCustomerWroteAt;
}
