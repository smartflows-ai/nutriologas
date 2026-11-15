// tests/free-slots-text.test.ts
// Ticket #103 (D10): the sentence the WhatsApp agent reads when a time was just taken.
// Run with: npx tsx --test tests/free-slots-text.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { alternativesSentence } from "../src/lib/free-slots";

const slot = (date: string, time: string) => ({ date, time, iso: `${date}T${time}:00-06:00` });

test("the sentence lists each free time with its day, in Mexico time", () => {
  const text = alternativesSentence([slot("2026-11-17", "10:30"), slot("2026-11-17", "16:00")]);
  assert.match(text, /^Los horarios libres más cercanos son: /);
  assert.match(text, /martes, 17 de noviembre a las 10:30 a\.\s?m\./);
  assert.match(text, /04:00 p\.\s?m\./);
});

test("a time ending in p.m. does not get a second period", () => {
  const text = alternativesSentence([slot("2026-11-17", "17:30")]);
  assert.doesNotMatch(text, /\.\.$/);
  assert.match(text, /\.$/);
});

test("no free time asks the agent to offer another day", () => {
  assert.equal(alternativesSentence([]), "No hay horarios libres cercanos; ofrece revisar otro día.");
});
