// src/lib/unsupported-media.ts
// Ticket #139: a patient who sends an audio, image, video or document cannot be read by the bot. The bot answers
// "write it to me" and the chat is marked as needing the team, without pausing the bot. Pure rules, no I/O: the route
// bot/media loads the chat and sends nothing itself. Out of scope for this wave (they stay silent, as before):
// stickers, reactions, location, contacts, captions read as text and any other or unknown message type.
import { customerTexts } from "@/lib/reminder-messages";
import { fill } from "@/lib/utils";

/** Minutes during which a second file in the same chat gets no second answer (five photos in a row: one answer). */
export const MEDIA_REPLY_COOLDOWN_MINUTES = 10;
const COOLDOWN_MS = MEDIA_REPLY_COOLDOWN_MINUTES * 60 * 1000;

/** The WhatsApp message types that count as a file the bot cannot read. */
const FILE_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "audioMessage",
  "imageMessage",
  "videoMessage",
  "documentMessage",
  "documentWithCaptionMessage",
]);

/** `file`: answer and mark the chat. `silent`: nothing changes, as before. Unknown types are silent. */
export function classifyInbound(messageType: unknown): "file" | "silent" {
  return typeof messageType === "string" && FILE_MESSAGE_TYPES.has(messageType) ? "file" : "silent";
}

/**
 * The same guards the normal flow applies before the agent runs (bot/contact-status): the workflow branch for files
 * leaves before that node, so the app repeats them. `ignore` means nothing is answered and nothing is flagged: the file
 * is still stored by whatsapp/sync, so the person who is attending sees it.
 */
export function mediaGate(input: {
  /** The sender is the owner or an active staff member of the business. */
  isTeam: boolean;
  /** The bot is on for every chat row of this contact (false after a manual pause, a person answering or a hand-off). */
  botEnabled: boolean;
  /** The contact asked to stop the messages. */
  optedOut: boolean;
}): "ignore" | "proceed" {
  return input.isTeam || !input.botEnabled || input.optedOut ? "ignore" : "proceed";
}

export interface MediaChatState {
  /** The help reason the chat had before this file arrived. */
  helpReason: string | null;
  helpRequestedAt: Date | null;
  /** The bot already sent this same answer to the chat inside the cooldown. */
  hasRecentReply: boolean;
}

/** False while a media request or an identical answer is recent: one answer per burst of files. */
export function shouldReplyToMedia(state: MediaChatState, now: Date): boolean {
  if (state.hasRecentReply) return false;
  if (state.helpReason === "unsupported_media" && state.helpRequestedAt) {
    return now.getTime() - state.helpRequestedAt.getTime() >= COOLDOWN_MS;
  }
  return true;
}

/** The answer to the patient, in the business language. It names no provider and promises no one in particular. */
export function mediaReplyText(language: string, businessName: string): string {
  return fill(customerTexts(language).mediaNotSupported, { negocio: businessName });
}
