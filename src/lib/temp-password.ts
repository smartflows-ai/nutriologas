// src/lib/temp-password.ts
// Temporary password the server creates when the owner adds a staff user or resets their password (ticket #22).
// It is shown to the owner once and the user must replace it on the first sign-in.
// Pure function with an injectable random source (tests in tests/temp-password.test.ts).
import { randomInt } from "node:crypto";

// No 0/O/o, 1/l/I: the owner reads it aloud or sends it by chat, and those are mistyped.
export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
// 14 characters from 56 symbols is about 81 bits: far beyond guessing, and above the 10-character minimum.
export const TEMP_PASSWORD_LENGTH = 14;

// `random(max)` returns an integer in [0, max). The default is the cryptographic generator.
export function generateTempPassword(random: (max: number) => number = (max) => randomInt(max)): string {
  return Array.from({ length: TEMP_PASSWORD_LENGTH }, () => TEMP_PASSWORD_ALPHABET[random(TEMP_PASSWORD_ALPHABET.length)]).join("");
}
