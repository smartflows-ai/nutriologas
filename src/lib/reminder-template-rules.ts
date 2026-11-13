// src/lib/reminder-template-rules.ts
// Rules for the texts a business writes for its reminder, confirmation and cancellation messages (tags in square
// brackets). Pure and free of server code, so the settings card runs the same checks while the owner types, and the
// server runs them again on save and at send time. `templateIssues` also says which fragments to highlight.
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";

export const TOKEN_FIELDS = [
  { key: "servicio", labelKey: "tokenService" },
  { key: "fecha", labelKey: "tokenDate" },
  { key: "hora", labelKey: "tokenTime" },
  { key: "hora_limite", labelKey: "tokenDeadline" },
  { key: "negocio", labelKey: "tokenBusiness" },
  { key: "nombre", labelKey: "tokenName" },
  { key: "ubicacion", labelKey: "tokenLocation" },
  { key: "responsable", labelKey: "tokenOwner" },
] as const;

export type TokenKey = (typeof TOKEN_FIELDS)[number]["key"];

const DICTIONARIES = [es, en];

// Labels of every language are accepted, so an owner can write the text in any language.
export const LABEL_TO_KEY = new Map<string, TokenKey>(
  DICTIONARIES.flatMap((dict) =>
    TOKEN_FIELDS.map((field) => [dict.crm.business[field.labelKey].toLowerCase(), field.key] as const),
  ),
);

const DEADLINE_LABELS = DICTIONARIES.map((dict) => dict.crm.business.tokenDeadline.toLowerCase());
const LOCATION_LABELS = DICTIONARIES.map((dict) => dict.crm.business.tokenLocation.toLowerCase());

export const MAX_TEMPLATE_LENGTH = 600;

export type TemplateKind = "reminder" | "confirmation" | "cancellation";

/** A problem in a text, with the exact fragments of the text to highlight (empty when it concerns the whole text). */
export interface TemplateIssue {
  /** Same code the API answers with, so the same message translation is used. */
  code: string;
  fragments: string[];
}

const TAG_PATTERN = /\[([^\[\]]+)\]/g;

function allTags(template: string): { text: string; label: string }[] {
  return Array.from(template.matchAll(TAG_PATTERN)).map((m) => ({ text: m[0], label: m[1].trim().toLowerCase() }));
}

function deadlineTags(template: string): string[] {
  return allTags(template)
    .filter((tag) => DEADLINE_LABELS.includes(tag.label))
    .map((tag) => tag.text);
}

function locationTags(template: string): string[] {
  return allTags(template)
    .filter((tag) => LOCATION_LABELS.includes(tag.label))
    .map((tag) => tag.text);
}

const VISIT_DETAIL_KEYS = new Set(["servicio", "fecha", "hora"]);

/** True when the text names the visit itself (service, date or time), so it can be sent on its own. */
export function hasVisitDetailTags(template: string): boolean {
  return allTags(template).some((tag) => {
    const key = LABEL_TO_KEY.get(tag.label);
    return key !== undefined && VISIT_DETAIL_KEYS.has(key);
  });
}

/** The index of the last line of the text that carries a visit detail tag, or -1. */
export function lastDetailLine(template: string): number {
  const lines = template.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) if (hasVisitDetailTags(lines[i])) return i;
  return -1;
}

/** True when the text places the address or video call link itself with the location tag. */
export function hasLocationTag(template: string): boolean {
  return locationTags(template).length > 0;
}

// Words a customer can answer with that the bot reads as a yes (`isClearConfirmation`, src/lib/confirmation-words.ts;
// a test keeps both lists in step). The confirmation text may ask for any of them.
export const REPLY_WORDS = ["si", "yes", "ok", "okay", "confirmo"] as const;

// "si" is also the Spanish conditional ("Si no la confirmas..."), so a lowercase word alone proves nothing.
// A word counts after a verb that asks for a reply ("Responde OK", "Reply with a YES"), and SI or YES in capitals
// count by themselves. OK never counts alone: it is too common in ordinary sentences.
const REPLY_VERBS = "responde|contesta|escribe|manda|envia|reply|answer|type|write|send";
const WORDS = REPLY_WORDS.join("|");
const REPLY_PHRASE = new RegExp(`\\b(?:${REPLY_VERBS})\\b[\\s"'*_]*(?:(?:con|with|un|una|a|an)\\s+)?[\\s"'*_]*\\b(?:${WORDS})\\b`, "ig");
const CAPITAL_WORD = /\b(?:SI|YES)\b/g;

function withoutAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** The pieces of the text that ask the customer to reply with a confirming word. Empty when it does not ask. */
function siRequests(template: string): string[] {
  const plain = withoutAccents(template);
  const phrases = Array.from(plain.matchAll(REPLY_PHRASE));
  // A capital word inside a phrase such as "Responde SI" is already part of that phrase.
  const loneSi = Array.from(plain.matchAll(CAPITAL_WORD)).filter(
    (si) => !phrases.some((p) => si.index! >= p.index! && si.index! < p.index! + p[0].length),
  );
  // Accent stripping keeps one character per letter, so positions in `plain` are positions in the original.
  return [...phrases, ...loneSi].map((m) => template.slice(m.index!, m.index! + m[0].length));
}

/**
 * Every problem of a text for its kind, in the order they are reported. The first one is what the API answers.
 * - Any kind: too long, or a bracketed word that is not one of the tags.
 * - Reminder and cancellation: no deadline tag (it only exists in the confirmation); a reminder must not ask for SI,
 *   because the confirmation request is added after it.
 * - Confirmation: needs the deadline tag and an explicit request to reply with a confirming word (SI, YES, OK...).
 */
export function templateIssues(template: string, kind: TemplateKind): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  if (template.length > MAX_TEMPLATE_LENGTH) issues.push({ code: "template_too_long", fragments: [] });

  const unknown = allTags(template).filter((tag) => !LABEL_TO_KEY.has(tag.label));
  if (unknown.length > 0) issues.push({ code: "template_unknown_tag", fragments: unknown.map((tag) => tag.text) });

  const deadline = deadlineTags(template);
  if (kind === "confirmation") {
    if (deadline.length === 0) issues.push({ code: "confirmation_missing_deadline", fragments: [] });
    if (siRequests(template).length === 0) issues.push({ code: "confirmation_missing_si", fragments: [] });
    return issues;
  }

  if (deadline.length > 0) issues.push({ code: "template_deadline_not_allowed", fragments: deadline });
  // The visit is cancelled: there is no place to go to.
  if (kind === "cancellation" && hasLocationTag(template)) {
    issues.push({ code: "template_location_not_allowed", fragments: locationTags(template) });
  }
  if (kind === "reminder") {
    const requests = siRequests(template);
    if (requests.length > 0) issues.push({ code: "template_repeats_confirmation", fragments: requests });
  }
  return issues;
}

/** The first problem a text has for its kind, or null when it can be saved and sent as written. */
export function templateProblem(template: string, kind: TemplateKind): string | null {
  return templateIssues(template, kind)[0]?.code ?? null;
}

export function validateTemplateLength(template: string): string | null {
  return template.length > MAX_TEMPLATE_LENGTH ? "template_too_long" : null;
}

/** Every bracketed word must be one of the tags: anything else would reach the customer exactly as typed. */
export function validateKnownTags(template: string): string | null {
  return allTags(template).some((tag) => !LABEL_TO_KEY.has(tag.label)) ? "template_unknown_tag" : null;
}

/** The deadline time only exists in the confirmation text. */
export function validateNoDeadlineTag(template: string): string | null {
  return deadlineTags(template).length > 0 ? "template_deadline_not_allowed" : null;
}

/** The location tag makes no sense in the cancellation text: the visit no longer happens. */
export function validateNoLocationTag(template: string): string | null {
  return hasLocationTag(template) ? "template_location_not_allowed" : null;
}

/** The reminder is followed by the confirmation text, which already asks to reply SI. */
export function validateReminderNoConfirmation(template: string): string | null {
  return siRequests(template).length > 0 ? "template_repeats_confirmation" : null;
}

/** A confirmation text must include the deadline and the request to reply SI. */
export function validateConfirmationTemplate(template: string): string | null {
  if (deadlineTags(template).length === 0) return "confirmation_missing_deadline";
  return siRequests(template).length === 0 ? "confirmation_missing_si" : null;
}

export type FixAction = "replace_time" | "remove_paragraph" | "remove_fragment";

export interface TemplateFix {
  action: FixAction;
  /** The text once the fix is applied. */
  text: string;
}

function removeFragments(template: string, fragments: string[]): string {
  const without = fragments.reduce((text, fragment) => text.split(fragment).join(""), template);
  // Close the gap the removal leaves ("Hola [x], te" -> "Hola , te" -> "Hola, te").
  return without.replace(/[ \t]+([,.;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}

function removeParagraphsWith(template: string, fragments: string[]): string | null {
  const paragraphs = template.split(/\n[ \t]*\n/);
  const kept = paragraphs.filter((paragraph) => !fragments.some((fragment) => paragraph.includes(fragment)));
  // Never empty the whole text: with a single paragraph the caller removes just the fragment.
  return kept.length > 0 && kept.length < paragraphs.length ? kept.join("\n\n").trim() : null;
}

/**
 * The one-click fix for a problem, or null when it concerns the whole text and the owner must write it.
 * `timeLabel` is the label of the appointment-time tag in the owner's language (the deadline cannot be used there).
 */
export function suggestFix(template: string, issue: TemplateIssue, kind: TemplateKind, timeLabel: string): TemplateFix | null {
  if (issue.fragments.length === 0) return null;

  if (issue.code === "template_deadline_not_allowed" && kind === "cancellation") {
    const text = issue.fragments.reduce((current, fragment) => current.split(fragment).join(`[${timeLabel}]`), template);
    return { action: "replace_time", text };
  }

  const removesParagraph = issue.code === "template_deadline_not_allowed" || issue.code === "template_repeats_confirmation";
  if (removesParagraph) {
    const text = removeParagraphsWith(template, issue.fragments);
    if (text !== null) return { action: "remove_paragraph", text };
  }
  return { action: "remove_fragment", text: removeFragments(template, issue.fragments) };
}

/**
 * The business-level fields a text uses but the business has not filled in: the owner's name and the business
 * location. Saving is refused while any of them is missing, and the error names the field to fill. The customer
 * name and the visit data are per visit, so they are never reported here.
 */
export type UnfilledField = "responsable" | "ubicacion";
export function unfilledFields(template: string, data: { ownerName: string | null | undefined; hasLocation: boolean }): UnfilledField[] {
  const used = new Set(allTags(template).map((t) => LABEL_TO_KEY.get(t.label)));
  const missing: UnfilledField[] = [];
  if (used.has("responsable") && !(data.ownerName ?? "").trim()) missing.push("responsable");
  if (used.has("ubicacion") && !data.hasLocation) missing.push("ubicacion");
  return missing;
}
