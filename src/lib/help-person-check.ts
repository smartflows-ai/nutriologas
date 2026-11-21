// src/lib/help-person-check.ts
// Ticket #129: the agent called request_human_help with person_requested while a customer booked for their daughter
// (name, age, own number), which paused the bot and sent the owner a false notice. Production shows the agent is right
// to hand off in other cases the fixed words miss (an angry customer, a named person), so the server refuses
// person_requested only when the current turn looks like booking for someone else and carries no explicit request,
// no named person and no complaint. Everything else is accepted. Pure: the caller loads the lines.
import { asksForPerson } from "./person-request";
import type { HelpReason } from "./help-reasons";

export interface ChatLine {
  /** True for the business side (bot or a person of the team). */
  fromMe: boolean;
  content: string;
}

const BOOKING_FOR_OTHER =
  /\bpara\s+(mi|su)\s+(hij[oa]|beb[eé]|mam[aá]|madre|pap[aá]|padre|espos[oa]|novi[oa]|herman[oa]|abuel[oa]|ni[ñn][oa]|sobrin[oa]|amig[oa])(?![a-záéíóúñ])|\bse\s+llama\b|\btiene\s+\d+\s+a[ñn]os\b|\bsu\s+(n[uú]mero|tel[eé]fono|whatsapp|celular)\b/i;
const NAMED_PERSON = /\bcomun[ií]c[a-záéíóúñ]*\s+con\b/i;
const COMPLAINT = /molest|enoj|enfad|mal\s+servicio|p[eé]sim|queja|harta|indignad/i;

/** The current turn: customer messages since the business's last reply (`lines` go newest first). */
function currentTurnOf(lines: readonly ChatLine[]): string[] {
  const turn: string[] = [];
  for (const line of lines) {
    if (line.fromMe) break;
    turn.push(line.content);
  }
  return turn;
}

/**
 * Does a customer message since the business's last reply ask for a person with the n8n guard's words? The flow waits
 * and answers a batch of customer messages at once, so every message of that batch counts. Null when there is no
 * customer message to read.
 */
export function customerAskedForPerson(lines: readonly ChatLine[]): boolean | null {
  const currentTurn = currentTurnOf(lines);
  if (currentTurn.length === 0) return null;
  return currentTurn.some((text) => asksForPerson(text));
}

/**
 * False only when the reason is person_requested and the current turn is booking for someone else with no explicit
 * request, no named person and no complaint. Unknown wording, anger, a named person or no message: accepted.
 */
export function personRequestAllowed(reason: HelpReason, lines: readonly ChatLine[]): boolean {
  if (reason !== "person_requested") return true;
  const turn = currentTurnOf(lines);
  if (turn.length === 0) return true;
  const text = turn.join("\n");
  if (!BOOKING_FOR_OTHER.test(text)) return true;
  return asksForPerson(text) || NAMED_PERSON.test(text) || COMPLAINT.test(text);
}
