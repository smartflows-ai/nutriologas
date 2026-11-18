// tests/time-zones.test.ts
// Ticket #111: the time zones a business can pick, their names for the owner and for the patient, and the first
// suggestion when the business has no address. Pure, no network.
// Run with: npx tsx --test tests/time-zones.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { isValidTimeZone } from "../src/lib/clinic-time";
import {
  TIME_ZONE_OPTIONS,
  suggestTimeZoneForPhone,
  timeZoneLabel,
  timeZoneOptionsFor,
} from "../src/lib/time-zones";

test("every option is a real IANA zone with names in Spanish and English", () => {
  assert.ok(TIME_ZONE_OPTIONS.length >= 14);
  const values = new Set<string>();
  for (const option of TIME_ZONE_OPTIONS) {
    assert.equal(isValidTimeZone(option.value), true, option.value);
    assert.ok(!values.has(option.value), `duplicate ${option.value}`);
    values.add(option.value);
    for (const text of [option.owner.es, option.owner.en, option.patient.es, option.patient.en]) {
      assert.ok(text.trim().length > 0, option.value);
      assert.doesNotMatch(text, /[\[\]{}]|America\/|Europe\//, option.value);
    }
  }
});

test("the list covers Mexico, the United States, Latin American capitals and Madrid", () => {
  const values = TIME_ZONE_OPTIONS.map((o) => o.value);
  for (const zone of [
    "America/Mexico_City", "America/Cancun", "America/Mazatlan", "America/Hermosillo", "America/Tijuana",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Bogota", "America/Lima", "America/Santiago", "America/Argentina/Buenos_Aires", "Europe/Madrid",
  ]) {
    assert.ok(values.includes(zone), zone);
  }
  assert.equal(values[0], "America/Mexico_City");
});

test("the patient reads the zone as a city, never as a technical name", () => {
  assert.equal(timeZoneLabel("America/Mexico_City", "es"), "hora de Ciudad de México");
  assert.equal(timeZoneLabel("America/Cancun", "es"), "hora de Cancún");
  assert.equal(timeZoneLabel("America/Mexico_City", "en"), "Mexico City time");
  assert.equal(timeZoneLabel("America/Cancun", "en"), "Cancun time");
});

test("a zone outside the list (detected by Google) still gets a readable name", () => {
  assert.equal(timeZoneLabel("America/Bahia_Banderas", "es"), "hora de Bahia Banderas");
  assert.equal(timeZoneLabel("America/Bahia_Banderas", "en"), "Bahia Banderas time");
  assert.equal(timeZoneLabel("America/Argentina/Cordoba", "es"), "hora de Cordoba");
  assert.equal(timeZoneLabel("UTC", "es"), "hora UTC");
});

test("an unknown language falls back to Spanish, the platform default", () => {
  assert.equal(timeZoneLabel("America/Cancun", "fr"), "hora de Cancún");
});

test("the owner's list adds the current zone when it is not one of the options", () => {
  const plain = timeZoneOptionsFor("America/Cancun");
  assert.equal(plain.length, TIME_ZONE_OPTIONS.length);
  const withExtra = timeZoneOptionsFor("America/Bahia_Banderas");
  assert.equal(withExtra.length, TIME_ZONE_OPTIONS.length + 1);
  assert.equal(withExtra[withExtra.length - 1].value, "America/Bahia_Banderas");
  assert.equal(withExtra[withExtra.length - 1].owner.es, "Bahia Banderas");
});

test("without an address, the first suggestion comes from the WhatsApp country code", () => {
  assert.equal(suggestTimeZoneForPhone("+528112345678"), "America/Mexico_City");
  assert.equal(suggestTimeZoneForPhone("+12125551234"), "America/New_York");
  assert.equal(suggestTimeZoneForPhone("+573001234567"), "America/Bogota");
  assert.equal(suggestTimeZoneForPhone("+51987654321"), "America/Lima");
  assert.equal(suggestTimeZoneForPhone("+56912345678"), "America/Santiago");
  assert.equal(suggestTimeZoneForPhone("+541112345678"), "America/Argentina/Buenos_Aires");
  assert.equal(suggestTimeZoneForPhone("+34612345678"), "Europe/Madrid");
  assert.equal(suggestTimeZoneForPhone("+4915112345678"), "America/Mexico_City");
  assert.equal(suggestTimeZoneForPhone(null), "America/Mexico_City");
  assert.equal(suggestTimeZoneForPhone(""), "America/Mexico_City");
});
