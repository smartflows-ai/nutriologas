// local-utils/whatsapp-number.test.ts
// Run: npx tsx --test local-utils/whatsapp-number.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWhatsAppDigits, isSameWhatsAppNumber } from "../src/lib/whatsapp-number";

test("keeps only the digits", () => {
  assert.equal(normalizeWhatsAppDigits("+52 55 1234 5678"), "525512345678");
  assert.equal(normalizeWhatsAppDigits("(55) 1234-5678"), "5512345678");
});

test("Mexican mobile 521 and 52 are the same number", () => {
  assert.equal(normalizeWhatsAppDigits("+521 55 1234 5678"), "525512345678");
  assert.equal(isSameWhatsAppNumber("+521 55 1234 5678", "+52 55 1234 5678"), true);
});

test("same number with and without plus or spaces is a match", () => {
  assert.equal(isSameWhatsAppNumber("+525512345678", "525512345678"), true);
  assert.equal(isSameWhatsAppNumber("+52 55-1234-5678", "+525512345678"), true);
});

test("different numbers do not match", () => {
  assert.equal(isSameWhatsAppNumber("+525512345678", "+525512345679"), false);
  assert.equal(isSameWhatsAppNumber("+525512345678", "+15125550100"), false);
});

test("an empty or missing number never matches", () => {
  assert.equal(isSameWhatsAppNumber("", "+525512345678"), false);
  assert.equal(isSameWhatsAppNumber(null, null), false);
  assert.equal(isSameWhatsAppNumber(undefined, "+525512345678"), false);
  assert.equal(isSameWhatsAppNumber("", ""), false);
});
