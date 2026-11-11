// tests/temp-password.test.ts
// Run: npx tsx --test tests/temp-password.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMP_PASSWORD_ALPHABET, TEMP_PASSWORD_LENGTH, generateTempPassword } from "../src/lib/temp-password";
import { passwordIssues } from "../src/lib/password-rules";

test("a temporary password has the fixed length", () => {
  assert.equal(generateTempPassword().length, TEMP_PASSWORD_LENGTH);
});

test("a temporary password only uses characters that cannot be confused when read aloud or typed", () => {
  for (const lookAlike of ["0", "O", "o", "1", "l", "I"]) {
    assert.equal(TEMP_PASSWORD_ALPHABET.includes(lookAlike), false, `alphabet must not include ${lookAlike}`);
  }
  const password = generateTempPassword();
  for (const char of password) assert.equal(TEMP_PASSWORD_ALPHABET.includes(char), true);
});

test("a temporary password passes the shared password rules", () => {
  assert.deepEqual(passwordIssues(generateTempPassword()), []);
});

test("the random source is injected, so the value is predictable in tests", () => {
  const alwaysFirst = () => 0;
  assert.equal(generateTempPassword(alwaysFirst), TEMP_PASSWORD_ALPHABET[0].repeat(TEMP_PASSWORD_LENGTH));
});

test("the random source is asked for an index inside the alphabet", () => {
  const asked: number[] = [];
  generateTempPassword((max) => {
    asked.push(max);
    return max - 1;
  });
  assert.deepEqual(asked, Array(TEMP_PASSWORD_LENGTH).fill(TEMP_PASSWORD_ALPHABET.length));
});

test("two generated passwords differ", () => {
  assert.notEqual(generateTempPassword(), generateTempPassword());
});

test("the alphabet has no repeated character, so every character is equally likely", () => {
  assert.equal(new Set(TEMP_PASSWORD_ALPHABET).size, TEMP_PASSWORD_ALPHABET.length);
});
