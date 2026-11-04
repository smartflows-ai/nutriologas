// src/lib/reminder-messages.ts
// Text of the appointment reminder, the confirmation request, the cancellation notice and the
// confirmation reply. Each business chooses its language (Tenant.messageLanguage); the default
// texts come from the translation files. Owners can override each text with their own, using
// plain labels in square brackets, such as [Hora límite]; renderTemplate fills them in.
import { formatSlotTime } from "@/lib/bot";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";

const TOKEN_FIELDS = [
  { key: "servicio", labelKey: "tokenService" },
  { key: "fecha", labelKey: "tokenDate" },
  { key: "hora", labelKey: "tokenTime" },
  { key: "hora_limite", labelKey: "tokenDeadline" },
  { key: "negocio", labelKey: "tokenBusiness" },
] as const;

type TokenKey = (typeof TOKEN_FIELDS)[number]["key"];

const DICTIONARIES = [es, en];

// Labels of every language are accepted, so an owner can write the text in any language.
const LABEL_TO_KEY = new Map<string, TokenKey>(
  DICTIONARIES.flatMap((dict) =>
    TOKEN_FIELDS.map((field) => [dict.crm.business[field.labelKey].toLowerCase(), field.key] as const),
  ),
);

const DEADLINE_LABELS = DICTIONARIES.map((dict) => dict.crm.business.tokenDeadline.toLowerCase());

/** True when the text has the deadline tag. Spaces and capitals inside the brackets are ignored, as when it is filled in. */
function usesDeadlineTag(template: string): boolean {
  return Array.from(template.matchAll(/\[([^\[\]]+)\]/g)).some((m) => DEADLINE_LABELS.includes(m[1].trim().toLowerCase()));
}

export const MAX_TEMPLATE_LENGTH = 600;

export type MessageLanguage = "es" | "en";

export function customerTexts(language: string) {
  return language === "en" ? en.customerMessages : es.customerMessages;
}

export interface ReminderValues {
  servicio: string;
  fecha: string;
  hora: string;
  hora_limite?: string;
  negocio: string;
}

export function renderTemplate(template: string, values: ReminderValues): string {
  return template.replace(/\[([^\[\]]+)\]/g, (match, label: string, offset: number, whole: string) => {
    const key = LABEL_TO_KEY.get(label.trim().toLowerCase());
    if (!key) return match;
    const value = values[key];
    if (value === undefined) return match;
    // "a.m." and "p.m." already end with a period: when the template closes its sentence right after the tag,
    // that period is the same one, so the customer does not read "10:00 a.m..".
    const nextChar = whole[offset + match.length];
    return value.endsWith(".") && nextChar === "." ? value.slice(0, -1) : value;
  });
}

/** Long date in the clinic zone, in the business language. */
export function clinicLongDate(instant: Date, language: string): string {
  return instant.toLocaleDateString(customerTexts(language).locale, {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function clinicTime(instant: Date, language: string): string {
  return language === "en"
    ? instant.toLocaleTimeString("en-US", { timeZone: "America/Mexico_City", hour: "numeric", minute: "2-digit" })
    : formatSlotTime(instant);
}

// "si" is also the Spanish conditional ("Si no la confirmas..."), so the lowercase word alone proves nothing.
// It counts only as SI in capitals, or right after a verb that asks for a reply.
const REPLY_VERBS = "responde|contesta|escribe|manda|envia|reply|answer|type|write|send";
const REPLY_PHRASE = new RegExp(`\\b(?:${REPLY_VERBS})\\b[\\s"'*_]*\\bsi\\b`, "i");

function asksToReplySi(textWithoutAccents: string): boolean {
  return /\bSI\b/.test(textWithoutAccents) || REPLY_PHRASE.test(textWithoutAccents);
}

/**
 * Checks a business's confirmation text. It must include the deadline and the word SI,
 * otherwise the customer is never told how to confirm or when the visit is released.
 */
export function validateConfirmationTemplate(template: string): string | null {
  if (!usesDeadlineTag(template)) return "confirmation_missing_deadline";
  // Accents are ignored, like the bot does when it reads the reply: "Sí" and "SI" both count as the word.
  const withoutAccents = template.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!asksToReplySi(withoutAccents)) return "confirmation_missing_si";
  return null;
}

/**
 * Every bracketed word must be one of the five tags. Anything else (a typo such as [Nombre]) would reach the
 * customer exactly as typed, with its brackets, so the text is rejected when saved.
 */
export function validateKnownTags(template: string): string | null {
  const tags = Array.from(template.matchAll(/\[([^\[\]]+)\]/g));
  return tags.some((m) => !LABEL_TO_KEY.has(m[1].trim().toLowerCase())) ? "template_unknown_tag" : null;
}

/**
 * The deadline time only exists for the confirmation text: a reminder can go out with no deadline at all
 * (confirmation off, or a window too short to ask). In the reminder and cancellation texts the tag would reach
 * the customer in brackets, so those texts are rejected when saved.
 */
export function validateNoDeadlineTag(template: string): string | null {
  return usesDeadlineTag(template) ? "template_deadline_not_allowed" : null;
}

/**
 * The reminder goes out followed by the confirmation text, which already asks the customer to reply SI.
 * A reminder that asks it too would make the customer read the request twice.
 */
export function validateReminderNoConfirmation(template: string): string | null {
  const withoutAccents = template.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return asksToReplySi(withoutAccents) ? "template_repeats_confirmation" : null;
}

export function validateTemplateLength(template: string): string | null {
  return template.length > MAX_TEMPLATE_LENGTH ? "template_too_long" : null;
}

export type TemplateKind = "reminder" | "confirmation" | "cancellation";

/** The first problem a stored text has for its kind, or null when it can go out as written. Same rules as when it is saved. */
export function templateProblem(template: string, kind: TemplateKind): string | null {
  const common = validateTemplateLength(template) ?? validateKnownTags(template);
  if (common) return common;
  if (kind === "confirmation") return validateConfirmationTemplate(template);
  const noDeadline = validateNoDeadlineTag(template);
  if (noDeadline) return noDeadline;
  return kind === "reminder" ? validateReminderNoConfirmation(template) : null;
}

/**
 * The text to send: the stored one when it passes the save-time checks, otherwise the default.
 * Saving is checked, but texts stored before those checks existed would reach the customer with raw tags in
 * brackets, so the same checks run again at send time. `onFallback` lets the caller log why (never shown to the customer).
 */
export function usableTemplate(
  stored: string | null | undefined,
  kind: TemplateKind,
  fallback: string,
  onFallback?: (problem: string) => void,
): string {
  if (!stored || stored.trim() === "") return fallback;
  const problem = templateProblem(stored, kind);
  if (!problem) return stored;
  onFallback?.(problem);
  return fallback;
}

/** Cancellation notice: the business text when valid, the language default otherwise. */
export function cancellationText(
  stored: string | null | undefined,
  values: ReminderValues,
  language: string,
  onFallback?: (problem: string) => void,
): string {
  return renderTemplate(usableTemplate(stored, "cancellation", customerTexts(language).cancellationTemplate, onFallback), values);
}
