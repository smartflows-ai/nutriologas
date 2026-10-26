// src/lib/greeting.ts
// The bot's greeting: a plain greeting gets a fixed reply (no model call), and the bot introduces itself
// again when nobody (bot or owner) wrote to the contact in the last hours. Pure functions, no I/O.
import { customerTexts } from "@/lib/reminder-messages";
import { fill } from "@/lib/utils";

/** Silence after which the bot introduces itself again. */
export const INTRO_WINDOW_HOURS = 12;
const INTRO_WINDOW_MS = INTRO_WINDOW_HOURS * 60 * 60 * 1000;

// Normalized greetings (lowercase, no accents, no punctuation).
const GREETINGS = new Set([
  "hola",
  "hey",
  "hi",
  "hello",
  "buenas",
  "buen dia",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
  "que tal",
  "hola buenas",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the whole message is only a greeting ("hola", "buenas tardes!"). A question or a request is not. */
export function isPureGreeting(text: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const normalized = normalize(text);
  if (!normalized || normalized.split(" ").length > 3) return false;
  return GREETINGS.has(normalized);
}

/** Introduce again when no message in the chat (from the bot or the owner) is newer than the window. */
export function introRequired(lastOutgoingAt: Date | null, now: Date = new Date()): boolean {
  if (!lastOutgoingAt) return true;
  return now.getTime() - lastOutgoingAt.getTime() >= INTRO_WINDOW_MS;
}

/**
 * Reply for a plain greeting, or null when the message is not a greeting.
 * The first contact (or one after the window) names the business; a greeting inside an active chat is short.
 */
export function buildGreetingReply(input: {
  text: string;
  businessName: string;
  language: string;
  introRequired: boolean;
}): string | null {
  if (!isPureGreeting(input.text)) return null;
  const texts = customerTexts(input.language);
  return fill(input.introRequired ? texts.greetingIntro : texts.greetingShort, { negocio: input.businessName });
}
