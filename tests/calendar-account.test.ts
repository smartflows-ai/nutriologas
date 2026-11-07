// Regression: the CRM shows which account an external calendar is linked to, read from the provider's own reply.
import test from "node:test";
import assert from "node:assert/strict";
import { emailFromGoogleUserInfo, emailFromGraphCalendar } from "../src/lib/calendar-account";

test("google: reads the account email", () => {
  assert.equal(emailFromGoogleUserInfo({ email: "doctor@gmail.com", name: "Doctor" }), "doctor@gmail.com");
});

test("google: trims spaces and rejects a value that is not an email", () => {
  assert.equal(emailFromGoogleUserInfo({ email: "  doctor@gmail.com " }), "doctor@gmail.com");
  assert.equal(emailFromGoogleUserInfo({ email: "not-an-email" }), null);
});

test("google: missing, empty or malformed reply gives null", () => {
  assert.equal(emailFromGoogleUserInfo({}), null);
  assert.equal(emailFromGoogleUserInfo(null), null);
  assert.equal(emailFromGoogleUserInfo("x"), null);
  assert.equal(emailFromGoogleUserInfo({ email: 42 }), null);
});

test("outlook: reads the calendar owner address", () => {
  assert.equal(emailFromGraphCalendar({ name: "Calendar", owner: { name: "Dra", address: "dra@outlook.com" } }), "dra@outlook.com");
});

test("outlook: missing owner or address gives null", () => {
  assert.equal(emailFromGraphCalendar({ name: "Calendar" }), null);
  assert.equal(emailFromGraphCalendar({ owner: {} }), null);
  assert.equal(emailFromGraphCalendar(undefined), null);
});
