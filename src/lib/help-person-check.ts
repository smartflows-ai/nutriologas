// src/lib/help-person-check.ts
// Ticket #129: the agent may call request_human_help with person_requested when nobody asked for a person (it did
// while a customer booked for their daughter with their own number), which paused the bot and sent the owner a
// false notice. The server accepts that reason only when a customer message of the current turn explicitly asks for
// a person, with the same wording rule as the n8n guard (asksForPerson). Pure: the caller loads the lines.
import { asksForPerson } from "./person-request";
import type { HelpReason } from "./help-reasons";

export interface ChatLine {
  /** True for the business side (bot or a person of the team). */
  fromMe: boolean;
  content: string;
}

/**
 * Does a customer message since the business's last reply ask for a person? The flow waits and answers a batch of
 * customer messages at once, so every message of that batch counts. `lines` go newest first. Null when there is no
 * customer message to read.
 */
export function customerAskedForPerson(lines: readonly ChatLine[]): boolean | null {
  const currentTurn: string[] = [];
  for (const line of lines) {
    if (line.fromMe) break;
    currentTurn.push(line.content);
  }
  if (currentTurn.length === 0) return null;
  return currentTurn.some((text) => asksForPerson(text));
}

/** False only when the reason is person_requested and the current turn clearly did not ask for a person. */
export function personRequestAllowed(reason: HelpReason, lines: readonly ChatLine[]): boolean {
  if (reason !== "person_requested") return true;
  // Nothing to read (a sync delay): accept, a real request must never be dropped.
  return customerAskedForPerson(lines) !== false;
}
