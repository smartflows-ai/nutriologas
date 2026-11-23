// src/lib/help-already-raised.ts
// Ticket #141 (execution 22960): when the SERVER already handed a chat over (booking_limit, unsupported_media, opted_out)
// and that request is still open, a later request_human_help from the model must not change its reason, raise its
// priority or tell the owner a second time. Pure rule: help-handler.ts reads the chats and applies it.
// Ticket #143 (execution 23110): the same happens with a reason the model raises (person_requested): the n8n guard raised
// it, the agent asked again, nothing changed and the answer was a bare raised: false, which the prompt reads as "do not
// promise a person". requestAlreadyOpen / alreadyOpenBody cover that case.
import { isReasonEnabled, type HelpReason } from "@/lib/help-reasons";
import { raiseHelp, type HelpState } from "@/lib/help-state";

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

/** True when asking for `reason` changes nothing because the request is already open (same reason or a higher one). */
export function requestAlreadyOpen(state: HelpState, reason: HelpReason, now: Date): boolean {
  if (!isReasonEnabled(reason) || state.priority <= 0) return false;
  return raiseHelp(state, reason, now).state === state;
}

/**
 * The answer when the model asks for help and a person is already told. It is raised: true on purpose: the agent's rule
 * for raised: false is "do not promise a person", and here the team really was told. The message is for the agent.
 */
export function alreadyOpenBody(paused: boolean) {
  return {
    raised: true as const,
    alreadyOpen: true as const,
    reason: "already_open" as const,
    paused,
    notified: null,
    message: "Una persona del equipo ya fue avisada y le dara seguimiento por este chat. Dile al cliente que una persona del equipo le dara seguimiento por este chat; no prometas tiempos ni llames de nuevo a request_human_help.",
  };
}
