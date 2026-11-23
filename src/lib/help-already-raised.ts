// src/lib/help-already-raised.ts
// Ticket #141 (execution 22960): when the SERVER already handed a chat over (booking_limit, unsupported_media, opted_out)
// and that request is still open, a later request_human_help from the model must not change its reason, raise its
// priority or tell the owner a second time. Pure rule: help-handler.ts reads the chats and applies it.

export interface HelpStateRow {
  helpReason: string | null;
  /** 0 when nothing is open (the request was handled). */
  helpPriority: number;
}

/** True when any chat of the contact has a request open whose reason only the server raises. */
export function serverReasonOpen(chats: readonly HelpStateRow[], serverReasons: ReadonlySet<string>): boolean {
  return chats.some((chat) => chat.helpPriority > 0 && chat.helpReason !== null && serverReasons.has(chat.helpReason));
}

/** The answer when the model asks again: a person is already told. The message is for the agent. */
export function alreadyRaisedBody() {
  return {
    raised: false as const,
    reason: "already_raised" as const,
    message: "Ya hay una persona avisada para este cliente. No prometas nada mas ni llames de nuevo a request_human_help; responde solo lo que ya se le dijo.",
  };
}
