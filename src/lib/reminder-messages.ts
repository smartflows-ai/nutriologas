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
  return template.replace(/\[([^\[\]]+)\]/g, (match, label: string) => {
    const key = LABEL_TO_KEY.get(label.trim().toLowerCase());
    if (!key) return match;
    return values[key] ?? match;
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

/**
 * Checks a business's confirmation text. It must include the deadline and the word SI,
 * otherwise the customer is never told how to confirm or when the visit is released.
 */
export function validateConfirmationTemplate(template: string): string | null {
  const lower = template.toLowerCase();
  if (!DEADLINE_LABELS.some((label) => lower.includes(`[${label}]`))) return "confirmation_missing_deadline";
  if (!/\bSI\b/i.test(template)) return "confirmation_missing_si";
  return null;
}

export function validateTemplateLength(template: string): string | null {
  return template.length > MAX_TEMPLATE_LENGTH ? "template_too_long" : null;
}
