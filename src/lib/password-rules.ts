// src/lib/password-rules.ts
// Rules for every password the platform sets: register, onboarding and the owner's change card.
// Login does not use these rules, so accounts created before them can still sign in.
// Pure functions, no I/O (tested in local-utils/password-rules.test.ts).

export const NEW_PASSWORD_MIN = 10;
// bcrypt ignores everything after 72 bytes; a longer password would not be what the owner typed.
export const NEW_PASSWORD_MAX = 72;

export type PasswordIssue = "too_short" | "too_long" | "common" | "same_as_current";

// Short list of the most used passwords. Compared in lowercase.
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd",
  "contraseña", "contrasena", "contraseña123", "contrasena123", "contraseña1234", "contrasena1234",
  "qwerty", "qwerty123", "qwertyuiop", "asdfghjkl", "abc123", "abcd1234", "123456789", "1234567890",
  "12345678", "123456789a", "111111111", "11111111", "00000000", "iloveyou", "letmein", "welcome",
  "welcome1", "admin123", "administrator", "monkey123", "dragon123", "football1", "baseball1",
  "sunshine1", "princess1", "trustno1", "changeme", "changeme1", "hola12345", "bienvenido", "bienvenida1",
]);

// API error code for each issue (keys of t.apiErrors, translated by the UI).
export const PASSWORD_API_ERROR: Record<
  PasswordIssue,
  "password_too_short" | "password_too_long" | "password_common" | "password_same_as_current"
> = {
  too_short: "password_too_short",
  too_long: "password_too_long",
  common: "password_common",
  same_as_current: "password_same_as_current",
};

// Form message key for each issue (keys of t.validation, translated by the UI).
export const PASSWORD_FORM_MESSAGE: Record<PasswordIssue, "passwordTooShort" | "passwordTooLong" | "passwordCommon" | "passwordSameAsCurrent"> = {
  too_short: "passwordTooShort",
  too_long: "passwordTooLong",
  common: "passwordCommon",
  same_as_current: "passwordSameAsCurrent",
};

// Returns every problem with a new password. An empty list means it is acceptable.
// `current` is the password the owner has now, when there is one.
export function passwordIssues(value: string, current?: string | null): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  // Length is counted in characters (code points), so accented letters count once.
  const length = Array.from(value).length;
  if (length < NEW_PASSWORD_MIN) issues.push("too_short");
  if (new TextEncoder().encode(value).length > NEW_PASSWORD_MAX) issues.push("too_long");
  if (COMMON_PASSWORDS.has(value.toLowerCase())) issues.push("common");
  if (current != null && current.length > 0 && value === current) issues.push("same_as_current");
  return issues;
}
