// src/lib/reminder-messages.ts
// Text of the appointment reminder, the confirmation request, the cancellation notice and the
// confirmation reply. Each business chooses its language (Tenant.messageLanguage); the default
// texts come from the translation files. Owners can override each text with their own, using
// plain labels in square brackets, such as [Hora límite]; renderTemplate fills them in.
import { formatSlotTime } from "@/lib/bot";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { LABEL_TO_KEY, lastDetailLine, templateProblem, type TemplateKind } from "@/lib/reminder-template-rules";
import { fill } from "@/lib/utils";

// The rules live in a module without server code so the settings card can run them too; re-exported here.
export {
  MAX_TEMPLATE_LENGTH,
  templateIssues,
  templateProblem,
  validateConfirmationTemplate,
  validateKnownTags,
  validateNoDeadlineTag,
  validateNoLocationTag,
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
  /** Business owner's name (the person who attends). Null or blank when unknown: the tag then disappears. */
  responsable?: string | null;
  /** Address (in person) or video call link (online) for the location tag; blank when there is nothing to show. */
  ubicacion?: string;
}

/** First name only: "Hola [Nombre]" reads naturally, a full name with two surnames does not. */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Drops a line that only labels the place ("📍 Ubicación: [Ubicación]") when there is no place to show (an
 * online visit whose video call is not created yet, or a business with no address), so the customer does not
 * read an empty "Ubicación:". A tag inside a longer sentence is left alone: the gap-closing rule handles it.
 */
function withoutEmptyPlaceLine(template: string): string {
  const lines = template.split("\n");
  const kept = lines.filter((line) => {
    const match = line.match(/^(.*?)\[([^\[\]]+)\]\s*$/);
    if (!match || LABEL_TO_KEY.get(match[2].trim().toLowerCase()) !== "ubicacion") return true;
    return !/[:：][*_~\s]*$/.test(match[1]);
  });
  return kept.length === lines.length ? template : kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function renderTemplate(template: string, values: ReminderValues): string {
  if (values.ubicacion !== undefined && !values.ubicacion.trim()) template = withoutEmptyPlaceLine(template);
  // An owner name left empty takes its bold or italic markers with it: "*[Owner name]*" must not leave "**".
  if (!(values.responsable ?? "").trim()) {
    // Only the markers go; the tag stays so the normal path empties it and closes the gap around it.
    template = template.replace(/[*_~]+(\[([^\[\]]+)\])[*_~]+/g, (whole, tag: string, label: string) =>
      LABEL_TO_KEY.get(label.trim().toLowerCase()) === "responsable" ? tag : whole,
    );
    // "con el [Nombre del médico]" with no name would leave "con el." behind: the article and the preposition before
    // the tag go with it. A tag in subject position ("te atenderá [Nombre del médico]") keeps its sentence.
    template = template.replace(/[ \t]*(?:\b(?:con|de|del|a|al|para)\s+)?\b(?:el|la|los|las)\s+\[([^\[\]]+)\]/gi, (whole, label: string) =>
      LABEL_TO_KEY.get(label.trim().toLowerCase()) === "responsable" ? "" : whole,
    );
  }
  // The same when WhatsApp bold or italic markers sit between the tag and that period ("*[Deadline time]*."):
  // the value keeps its own period inside the markers and the template's period is dropped.
  template = template.replace(/(\[[^\[\]]+\])([*_~]+)\./g, (whole, tag: string, marks: string) => {
    const key = LABEL_TO_KEY.get(tag.slice(1, -1).trim().toLowerCase());
    const value = key && key !== "nombre" ? values[key] : undefined;
    return value?.endsWith(".") ? tag + marks : whole;
  });
  let nameWasEmpty = false;
  let placeWasEmpty = false;
  let ownerWasEmpty = false;
  const filled = template.replace(/\[([^\[\]]+)\]/g, (match, label: string, offset: number, whole: string) => {
    const key = LABEL_TO_KEY.get(label.trim().toLowerCase());
    if (!key) return match;
    if (key === "responsable") {
      const owner = (values.responsable ?? "").trim();
      if (!owner) ownerWasEmpty = true;
      return owner;
    }
    if (key === "nombre") {
      const name = firstName(values.nombre);
      if (!name) nameWasEmpty = true;
      return name;
    }
    const value = values[key];
    if (value === undefined) return match;
    if (key === "ubicacion" && !value.trim()) placeWasEmpty = true;
    // "a.m." and "p.m." already end with a period: when the template closes its sentence right after the tag,
    // that period is the same one, so the customer does not read "10:00 a.m..".
    const nextChar = whole[offset + match.length];
    return value.endsWith(".") && nextChar === "." ? value.slice(0, -1) : value;
  });
  // An unknown name or place leaves its tag empty: close the gap ("Hola , te" -> "Hola, te", "de  la" -> "de la").
  return nameWasEmpty || placeWasEmpty || ownerWasEmpty ? filled.replace(/[ \t]+([,.;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ") : filled;
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

/**
 * What the location tag shows: the address and directions link for an in person visit (older visits count as in
 * person), the secure video call link for an online one. Blank when there is nothing to show.
 */
export function placeText(
  visit: { modality?: "IN_PERSON" | "ONLINE" | null; meetUrl?: string | null },
  locationText: string | null | undefined,
): string {
  if (visit.modality === "ONLINE") {
    const url = visit.meetUrl?.trim();
    return url && url.startsWith("https://") ? url : "";
  }
  return locationText?.trim() ?? "";
}

/**
 * Adds the business address (with its directions link) under a message when the visit is in person. Visits from
 * before the modality existed count as in person. Nothing is added for online visits (they get the video call
 * link) or when the business has no physical location (`locationText` empty).
 */
export function withLocation(
  text: string,
  visit: { modality?: "IN_PERSON" | "ONLINE" | null },
  locationText: string | null | undefined,
  language: string,
): string {
  const place = locationText?.trim();
  if (visit.modality === "ONLINE" || !place) return text;
  return `${text}\n\n${fill(customerTexts(language).locationLine, { location: place })}`;
}

/** The line that tells where to go: the address (in person) or the video call link (online); null when there is none. */
export function placeLine(
  visit: { modality?: "IN_PERSON" | "ONLINE" | null; meetUrl?: string | null },
  locationText: string | null | undefined,
  language: string,
): string | null {
  const place = placeText(visit, locationText);
  if (!place) return null;
  const texts = customerTexts(language);
  return visit.modality === "ONLINE" ? fill(texts.meetingLine, { url: place }) : fill(texts.locationLine, { location: place });
}

/**
 * Puts the place line right after the last line of the visit details ("Hora: 10:00 a.m."), where the template
 * has no location tag of its own. `template` is the text before rendering and `rendered` the same text after:
 * they have the same lines. With no detail line the place goes at the end.
 */
export function withPlaceAfterDetails(template: string, rendered: string, line: string): string {
  const lines = rendered.split("\n");
  const at = lastDetailLine(template);
  if (at < 0 || at >= lines.length) return `${rendered}\n\n${line}`;
  lines.splice(at + 1, 0, line);
  return lines.join("\n");
}

/**
 * A visit booked for someone else lands on that person's own WhatsApp, often as the first message they ever get from
 * the business. Adds who booked it (first name only) and how to say it was not requested.
 */
export function withBookedBy(
  text: string,
  visit: { referredByKey?: string | null; referredByName?: string | null },
  language: string,
): string {
  if (!visit.referredByKey) return text;
  const texts = customerTexts(language);
  const name = firstName(visit.referredByName);
  return `${text}

${name ? fill(texts.bookedByLine, { nombre: name }) : texts.bookedByAnon}`;
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
