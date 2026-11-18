// The WhatsApp number of a staff member (where "a chat needs help" notices go).
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStaffWhatsapp } from "../src/lib/staff-whatsapp";

test("a number with country code is stored as + and digits", () => {
  assert.equal(normalizeStaffWhatsapp("+52 55 1234 5678"), "+525512345678");
  assert.equal(normalizeStaffWhatsapp("+1 (305) 555-0100"), "+13055550100");
});

test("ten digits without a country code get the default one (+52)", () => {
  assert.equal(normalizeStaffWhatsapp("55 1234 5678"), "+525512345678");
});

test("digits without a plus that already include the country code are kept", () => {
  assert.equal(normalizeStaffWhatsapp("525512345678"), "+525512345678");
});

test("an empty value clears the number", () => {
  assert.equal(normalizeStaffWhatsapp(""), null);
  assert.equal(normalizeStaffWhatsapp("   "), null);
  assert.equal(normalizeStaffWhatsapp(null), null);
});

test("something that is not a phone number is invalid", () => {
  assert.equal(normalizeStaffWhatsapp("hola"), "invalid");
  assert.equal(normalizeStaffWhatsapp("123"), "invalid");
  assert.equal(normalizeStaffWhatsapp("+1234567890123456"), "invalid");
  assert.equal(normalizeStaffWhatsapp(12345678901 as unknown as string), "invalid");
});
