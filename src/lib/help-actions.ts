// src/lib/help-actions.ts
// What the team can do with a chat that needs help. Each action returns the fields to write; the route hands them
// to Prisma. Pure.
import { can } from "@/lib/permissions";
import { isHelpReason, pausesBot } from "@/lib/help-reasons";

type Role = Parameters<typeof can>[0];

/** The reason stored when taking a chat paused the bot (the bot must not answer over the person who took it). */
export const TAKEN_PAUSE = "taken";

/** Taking a chat puts the person in charge and stops the escalation. A bot that was still answering is paused. */
export function takePatch(userId: string, now: Date, botEnabled: boolean) {
  const base = { assignedToId: userId, helpTakenAt: now };
  return botEnabled ? { ...base, botEnabled: false, botPausedReason: TAKEN_PAUSE } : base;
}

/** Clears the help state. Who is in charge of the chat stays, so the next request goes to the same person. */
export function resolvePatch() {
  return {
    helpReason: null,
    helpPriority: 0,
    helpRequestedAt: null,
    helpAssigneeNotifiedAt: null,
    helpOwnerNotifiedAt: null,
    helpTakenAt: null,
    helpCustomerWroteAt: null,
  };
}

/** Answering from the panel is the proof that somebody took care of the chat. */
export function repliedPatch(userId: string) {
  return { ...resolvePatch(), assignedToId: userId };
}

/** The owner puts an assistant in charge (the time starts the in-app notice and the WhatsApp reminder), or nobody. */
export function assignPatch(assigneeId: string | null, now: Date) {
  return assigneeId ? { assignedToId: assigneeId, helpAssignedAt: now } : { assignedToId: null, helpAssignedAt: null };
}

export function canAssignHelp(role: Role): boolean {
  return can(role, "users.manage");
}

/** The pause was put there by a hand-off (a purchase, a person asked for) or by taking the chat, not by the owner. */
function isHandoffPause(botPausedReason: string | null | undefined): boolean {
  return botPausedReason === TAKEN_PAUSE || (isHelpReason(botPausedReason) && pausesBot(botPausedReason));
}

/** Marking a chat handled turns the bot back on only when the hand-off paused it; the owner's own pause stays. */
export function resumeBotPatch(botPausedReason: string | null | undefined): { botEnabled: true; botPausedReason: null } | Record<string, never> {
  return isHandoffPause(botPausedReason) ? { botEnabled: true, botPausedReason: null } : {};
}

/** A person writing into a chat paused by a hand-off: the bot stays off, and the reason now says a person is writing. */
export function ownerTookOverPatch(botPausedReason: string | null | undefined): { botPausedReason: "owner_reply" } | Record<string, never> {
  return isHandoffPause(botPausedReason) ? { botPausedReason: "owner_reply" } : {};
}
