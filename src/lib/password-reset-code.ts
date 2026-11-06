// src/lib/password-reset-code.ts
// One-time code for resetting a forgotten owner password. Pure functions: no database, no WhatsApp.
// The route stores only the hash, the expiry and the attempt count (see the plan in .claude/plans).
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Short on purpose: a reset code is single use and should not stay usable for long.
// Sources found: no official value for reset codes; authenticator codes use 30-60 s and
// the 10-minute ceiling in several guidelines is a maximum. 5 minutes gives time to switch
// from WhatsApp to the page.
export const RESET_CODE_TTL_MS = 5 * 60 * 1000;
export const RESET_CODE_MAX_ATTEMPTS = 5;

export type ResetCodeFailure = "no_code" | "expired" | "too_many_attempts" | "wrong_code";

// Six digits, zero padded. `random` is injectable so tests can fix the value.
export function generateResetCode(random: (max: number) => number = (max) => randomInt(max)): string {
  return String(random(1_000_000)).padStart(6, "0");
}

// HMAC with the server secret, so a leaked database row cannot be turned back into the code.
export function hashResetCode(code: string, secret: string): string {
  return createHmac("sha256", secret).update(code).digest("hex");
}

export interface ResetCodeCheck {
  storedHash: string | null;
  expiresAt: Date | null;
  attempts: number;
  code: string;
  secret: string;
  now: Date;
}

// Order matters: a used-up code stays blocked even if it is right, and an expired one is never compared.
export function checkResetCode(input: ResetCodeCheck): { ok: true } | { ok: false; reason: ResetCodeFailure } {
  if (!input.storedHash || !input.expiresAt) return { ok: false, reason: "no_code" };
  if (input.attempts >= RESET_CODE_MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  if (input.now.getTime() > input.expiresAt.getTime()) return { ok: false, reason: "expired" };
  if (!/^\d{6}$/.test(input.code)) return { ok: false, reason: "wrong_code" };

  const candidate = Buffer.from(hashResetCode(input.code, input.secret), "hex");
  const stored = Buffer.from(input.storedHash, "hex");
  if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) {
    return { ok: false, reason: "wrong_code" };
  }
  return { ok: true };
}
