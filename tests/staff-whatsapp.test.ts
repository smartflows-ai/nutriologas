// The WhatsApp number of a staff member (where "a chat needs help" notices go).
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStaffWhatsapp, requireStaffWhatsapp } from "../src/lib/staff-whatsapp";

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

test("ten local digits get the business country code when it is given (ticket #120)", () => {
  assert.equal(normalizeStaffWhatsapp("300 123 4567", "57"), "+573001234567");
  assert.equal(normalizeStaffWhatsapp("+52 55 1234 5678", "57"), "+525512345678");
  assert.equal(normalizeStaffWhatsapp("55 1234 5678"), "+525512345678");
});

// ---- Ticket #176: the number is required for a staff member ----

test("a required number: missing, empty or blank is refused with staff_whatsapp_required", () => {
  for (const input of [undefined, null, "", "   "]) {
    assert.deepEqual(requireStaffWhatsapp(input, "52"), { ok: false, reason: "staff_whatsapp_required" }, String(input));
  }
});

test("a required number: ten Mexican digits, with or without spaces, give +52 and digits", () => {
  assert.deepEqual(requireStaffWhatsapp("55 1234 5678", "52"), { ok: true, number: "+525512345678" });
  assert.deepEqual(requireStaffWhatsapp("+525512345678", "52"), { ok: true, number: "+525512345678" });
});

test("a required number: +52 needs exactly ten digits after it", () => {
  assert.deepEqual(requireStaffWhatsapp("+52551234567", "52"), { ok: false, reason: "staff_whatsapp_invalid" }, "nine digits");
  assert.deepEqual(requireStaffWhatsapp("+5255123456789", "52"), { ok: false, reason: "staff_whatsapp_invalid" }, "eleven digits");
});

test("a required number: another country keeps its own length rules", () => {
  assert.deepEqual(requireStaffWhatsapp("+57 300 123 4567", "52"), { ok: true, number: "+573001234567" });
  assert.deepEqual(requireStaffWhatsapp("300 123 4567", "57"), { ok: true, number: "+573001234567" });
});

test("a required number: text and numbers that are too short or long are invalid", () => {
  for (const input of ["hola", "123", "+1234567890123456", 5512345678 as unknown as string]) {
    assert.deepEqual(requireStaffWhatsapp(input, "52"), { ok: false, reason: "staff_whatsapp_invalid" }, String(input));
  }
});
