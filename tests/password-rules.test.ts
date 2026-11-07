// local-utils/password-rules.test.ts
// Run: npx tsx --test local-utils/password-rules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEW_PASSWORD_MAX,
  NEW_PASSWORD_MIN,
  passwordIssues,
} from "../src/lib/password-rules";

const LONG_ENOUGH = "correct horse battery";

test("rejects a password shorter than the minimum", () => {
  const short = "a".repeat(NEW_PASSWORD_MIN - 1);
  assert.deepEqual(passwordIssues(short), ["too_short"]);
});

test("accepts a password exactly at the minimum length", () => {
  assert.deepEqual(passwordIssues("a".repeat(NEW_PASSWORD_MIN)), []);
});

test("accepts a password exactly at the maximum length", () => {
  assert.deepEqual(passwordIssues("a".repeat(NEW_PASSWORD_MAX)), []);
});

test("rejects a password longer than the bcrypt limit", () => {
  assert.deepEqual(passwordIssues("a".repeat(NEW_PASSWORD_MAX + 1)), ["too_long"]);
});

test("rejects a common password even when long enough", () => {
  assert.deepEqual(passwordIssues("password123"), ["common"]);
  assert.deepEqual(passwordIssues("PASSWORD123"), ["common"]);
});

test("rejects a new password equal to the current one", () => {
  assert.deepEqual(passwordIssues(LONG_ENOUGH, LONG_ENOUGH), ["same_as_current"]);
});

test("accepts a new password different from the current one", () => {
  assert.deepEqual(passwordIssues("another long phrase", LONG_ENOUGH), []);
});

test("does not require symbols, digits or mixed case", () => {
  assert.deepEqual(passwordIssues("abcdefghijk"), []);
});

test("counts length in characters, not bytes (accents count once)", () => {
  // 12 characters, 15 bytes in UTF-8: the minimum is about characters
  assert.deepEqual(passwordIssues("contraseñaáé"), []);
  assert.deepEqual(passwordIssues("ñáéíóúñáé"), ["too_short"]); // 9 characters
});

test("reports every problem at once", () => {
  assert.deepEqual(passwordIssues("short", "short"), ["too_short", "same_as_current"]);
});
