// src/i18n/validation.ts
// Zod schemas (src/lib/validations) carry stable message keys. This maps a key to the translated text.
import type { Translations } from "./types";

export function translateValidation(t: Translations, message?: string): string | undefined {
  if (!message) return undefined;
  return (t.validation as Record<string, string>)[message] ?? message;
}
