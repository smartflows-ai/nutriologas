// src/lib/reminder-messages.ts
// Text of the appointment reminder, the confirmation request, the cancellation notice and the
// confirmation reply. Each business chooses its language (Tenant.messageLanguage); the default
// texts come from the translation files. Owners can override each text with their own, using
// plain labels in square brackets, such as [Hora límite]; renderTemplate fills them in.
import { formatSlotTime } from "@/lib/bot";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { LABEL_TO_KEY, templateProblem, type TemplateKind } from "@/lib/reminder-template-rules";
import { fill } from "@/lib/utils";

// The rules live in a module without server code so the settings card can run them too; re-exported here.
export {
  MAX_TEMPLATE_LENGTH,
  templateIssues,
  templateProblem,
  validateConfirmationTemplate,
  validateKnownTags,
  validateNoDeadlineTag,
  validateReminderNoConfirmation,
  validateTemplateLength,
} from "@/lib/reminder-template-rules";
export type { TemplateIssue, TemplateKind } from "@/lib/reminder-template-rules";

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
  /** Customer's name as typed when booking. Null or blank when unknown: the tag then disappears. */
  nombre?: string | null;
}

/** First name only: "Hola [Nombre]" reads naturally, a full name with two surnames does not. */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function renderTemplate(template: string, values: ReminderValues): string {
  let nameWasEmpty = false;
  const filled = template.replace(/\[([^\[\]]+)\]/g, (match, label: string, offset: number, whole: string) => {
    const key = LABEL_TO_KEY.get(label.trim().toLowerCase());
    if (!key) return match;
    if (key === "nombre") {
      const name = firstName(values.nombre);
      if (!name) nameWasEmpty = true;
      return name;
    }
    const value = values[key];
    if (value === undefined) return match;
    // "a.m." and "p.m." already end with a period: when the template closes its sentence right after the tag,
    // that period is the same one, so the customer does not read "10:00 a.m..".
    const nextChar = whole[offset + match.length];
    return value.endsWith(".") && nextChar === "." ? value.slice(0, -1) : value;
  });
  // An unknown name leaves its tag empty: close the gap ("Hola , te" -> "Hola, te", "de  la" -> "de la").
  return nameWasEmpty ? filled.replace(/[ \t]+([,.;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ") : filled;
}

/**
 * Adds the video call link under a message when the visit is online and has one. Only secure web links are added.
 * A patient who gave no email gets no calendar invitation, so this is how the link reaches them.
 */
export function withMeetingLink(
  text: string,
  visit: { modality?: "IN_PERSON" | "ONLINE" | null; meetUrl?: string | null },
  language: string,
): string {
  const url = visit.meetUrl?.trim();
  if (visit.modality !== "ONLINE" || !url || !url.startsWith("https://")) return text;
  return `${text}\n\n${fill(customerTexts(language).meetingLine, { url })}`;
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
