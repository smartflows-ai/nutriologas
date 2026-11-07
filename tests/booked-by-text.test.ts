// tests/booked-by-text.test.ts
// A visit booked for someone else reaches that person's own WhatsApp: the first message tells who booked it and how
// to say it was not requested. The booker's name comes from the registry or, failing that, from the WhatsApp profile.
// Run with: npx tsx --test tests/booked-by-text.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { withBookedBy } from "../src/lib/reminder-messages";
import { cleanSenderName } from "../src/lib/patient-intake";

test("a visit booked by someone else says who booked it and how to cancel, in the business language", () => {
  const es = withBookedBy("Recordatorio", { referredByKey: "528446683688", referredByName: "Ana Lopez Ruiz" }, "es");
  assert.match(es, /^Recordatorio\n\n/);
  assert.match(es, /Ana/);
  assert.doesNotMatch(es, /Lopez|Ruiz/, "only the first name of the booker is shared");
  assert.match(es, /responde a este mensaje/i);
  const en = withBookedBy("Reminder", { referredByKey: "528446683688", referredByName: "Ana Lopez" }, "en");
  assert.match(en, /Ana/);
  assert.match(en, /reply to this message/i);
});

test("without a known booker name the text says another person booked it", () => {
  const text = withBookedBy("Hola", { referredByKey: "528446683688", referredByName: null }, "es");
  assert.match(text, /otra persona/);
  assert.doesNotMatch(text, /null|undefined|\{/);
});

test("a visit the person booked for themselves is not changed", () => {
  assert.equal(withBookedBy("Hola", { referredByKey: null, referredByName: null }, "es"), "Hola");
  assert.equal(withBookedBy("Hola", {}, "es"), "Hola");
});

test("the WhatsApp profile name is cleaned before it is stored as the booker", () => {
  assert.equal(cleanSenderName("  Ana   Lopez "), "Ana Lopez");
  assert.equal(cleanSenderName(""), null);
  assert.equal(cleanSenderName("   "), null);
  assert.equal(cleanSenderName(undefined), null);
  assert.equal(cleanSenderName(42), null);
  assert.equal(cleanSenderName("x".repeat(200))?.length, 80);
});
