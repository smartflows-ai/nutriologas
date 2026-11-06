// local-utils/password-reset-code.test.ts
// Run: npx tsx --test local-utils/password-reset-code.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RESET_CODE_MAX_ATTEMPTS,
  RESET_CODE_TTL_MS,
  checkResetCode,
  generateResetCode,
  hashResetCode,
} from "../src/lib/password-reset-code";

const SECRET = "test-secret-with-enough-length";
const NOW = new Date("2026-11-06T12:00:00.000Z");
const LATER = new Date(NOW.getTime() + 60_000);

test("generates a 6-digit code, zero padded", () => {
  assert.equal(generateResetCode(() => 42), "000042");
  assert.equal(generateResetCode(() => 123456), "123456");
});

test("generated code is always 6 digits for the full range", () => {
  for (const n of [0, 1, 999_999]) {
    assert.match(generateResetCode(() => n), /^\d{6}$/);
  }
});

test("hash does not contain the code in clear", () => {
  const hash = hashResetCode("123456", SECRET);
  assert.equal(hash.includes("123456"), false);
});

test("same code and secret give the same hash; another secret does not", () => {
  assert.equal(hashResetCode("123456", SECRET), hashResetCode("123456", SECRET));
  assert.notEqual(hashResetCode("123456", SECRET), hashResetCode("123456", "other-secret-value-here"));
});

test("accepts the right code before it expires", () => {
  const result = checkResetCode({
    storedHash: hashResetCode("123456", SECRET),
    expiresAt: new Date(NOW.getTime() + RESET_CODE_TTL_MS),
    attempts: 0,
    code: "123456",
    secret: SECRET,
    now: NOW,
  });
  assert.deepEqual(result, { ok: true });
});

test("rejects when no code was requested", () => {
  const result = checkResetCode({
    storedHash: null,
    expiresAt: null,
    attempts: 0,
    code: "123456",
    secret: SECRET,
    now: NOW,
  });
  assert.deepEqual(result, { ok: false, reason: "no_code" });
});

test("rejects an expired code even when it is right", () => {
  const result = checkResetCode({
    storedHash: hashResetCode("123456", SECRET),
    expiresAt: new Date(NOW.getTime() - 1),
    attempts: 0,
    code: "123456",
    secret: SECRET,
    now: LATER,
  });
  assert.deepEqual(result, { ok: false, reason: "expired" });
});

test("rejects a wrong code and reports it as wrong", () => {
  const result = checkResetCode({
    storedHash: hashResetCode("123456", SECRET),
    expiresAt: new Date(NOW.getTime() + RESET_CODE_TTL_MS),
    attempts: 0,
    code: "654321",
    secret: SECRET,
    now: NOW,
  });
  assert.deepEqual(result, { ok: false, reason: "wrong_code" });
});

test("blocks everything once the attempts are used up, even with the right code", () => {
  const result = checkResetCode({
    storedHash: hashResetCode("123456", SECRET),
    expiresAt: new Date(NOW.getTime() + RESET_CODE_TTL_MS),
    attempts: RESET_CODE_MAX_ATTEMPTS,
    code: "123456",
    secret: SECRET,
    now: NOW,
  });
  assert.deepEqual(result, { ok: false, reason: "too_many_attempts" });
});

test("rejects a code that is not 6 digits without hashing it", () => {
  const result = checkResetCode({
    storedHash: hashResetCode("123456", SECRET),
    expiresAt: new Date(NOW.getTime() + RESET_CODE_TTL_MS),
    attempts: 0,
    code: "12345",
    secret: SECRET,
    now: NOW,
  });
  assert.deepEqual(result, { ok: false, reason: "wrong_code" });
});

test("ttl is 5 minutes and attempts are 5", () => {
  assert.equal(RESET_CODE_TTL_MS, 5 * 60 * 1000);
  assert.equal(RESET_CODE_MAX_ATTEMPTS, 5);
});
