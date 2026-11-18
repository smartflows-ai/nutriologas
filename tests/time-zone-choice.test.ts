// tests/time-zone-choice.test.ts
// Ticket #111: which time zone a business keeps when it saves its profile. The owner's own choice always wins and
// sticks; otherwise a new address is asked to Google; a failed lookup never changes the zone.
// Run with: npx tsx --test tests/time-zone-choice.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { chooseTimeZone, shouldDetectTimeZone, type TimeZoneState } from "../src/lib/time-zone-choice";

const DEFAULT: TimeZoneState = { timeZone: "America/Mexico_City", source: "default" };
const GOOGLE: TimeZoneState = { timeZone: "America/Cancun", source: "google" };
const MANUAL: TimeZoneState = { timeZone: "America/Tijuana", source: "manual" };

test("a new address asks Google unless the owner chose the zone by hand", () => {
  assert.equal(shouldDetectTimeZone({ current: DEFAULT, requested: undefined, addressChanged: true }), true);
  assert.equal(shouldDetectTimeZone({ current: GOOGLE, requested: undefined, addressChanged: true }), true);
  assert.equal(shouldDetectTimeZone({ current: MANUAL, requested: undefined, addressChanged: true }), false);
  assert.equal(shouldDetectTimeZone({ current: DEFAULT, requested: undefined, addressChanged: false }), false);
});

test("with a new address Google is asked also when the form sends a zone, to know if it is Google's proposal", () => {
  assert.equal(shouldDetectTimeZone({ current: DEFAULT, requested: "America/Hermosillo", addressChanged: true }), true);
  // The form sends the zone it shows: the same value is not a choice.
  assert.equal(shouldDetectTimeZone({ current: DEFAULT, requested: "America/Mexico_City", addressChanged: true }), true);
  // A zone chosen by hand is only re-checked when the owner sends a different one with the new address.
  assert.equal(shouldDetectTimeZone({ current: MANUAL, requested: "America/Tijuana", addressChanged: true }), false);
  assert.equal(shouldDetectTimeZone({ current: MANUAL, requested: "America/Cancun", addressChanged: true }), true);
});

test("accepting the zone the screen proposed from the address keeps it as detected, not manual", () => {
  assert.deepEqual(
    chooseTimeZone({ current: DEFAULT, requested: "America/Cancun", addressChanged: true, detected: "America/Cancun" }),
    { timeZone: "America/Cancun", source: "google", detection: "detected" },
  );
});

test("picking a zone different from Google's proposal is the owner's choice", () => {
  assert.deepEqual(
    chooseTimeZone({ current: DEFAULT, requested: "America/Mexico_City", addressChanged: false, detected: null }),
    { timeZone: "America/Mexico_City", source: "default", detection: "skipped" },
  );
  assert.deepEqual(
    chooseTimeZone({ current: DEFAULT, requested: "America/Hermosillo", addressChanged: true, detected: "America/Cancun" }),
    { timeZone: "America/Hermosillo", source: "manual", detection: "skipped" },
  );
});

test("the owner's choice is kept and marked manual", () => {
  const result = chooseTimeZone({ current: DEFAULT, requested: "America/Hermosillo", addressChanged: false, detected: null });
  assert.deepEqual(result, { timeZone: "America/Hermosillo", source: "manual", detection: "skipped" });
});

test("sending the zone already saved changes nothing", () => {
  assert.deepEqual(chooseTimeZone({ current: GOOGLE, requested: "America/Cancun", addressChanged: false, detected: null }), {
    ...GOOGLE,
    detection: "skipped",
  });
});

test("Google's answer for a new address replaces a default or detected zone", () => {
  assert.deepEqual(chooseTimeZone({ current: DEFAULT, requested: undefined, addressChanged: true, detected: "America/Cancun" }), {
    timeZone: "America/Cancun",
    source: "google",
    detection: "detected",
  });
  assert.deepEqual(
    chooseTimeZone({ current: GOOGLE, requested: "America/Cancun", addressChanged: true, detected: "America/Tijuana" }),
    { timeZone: "America/Tijuana", source: "google", detection: "detected" },
  );
});

test("a failed lookup keeps the zone and says so", () => {
  assert.deepEqual(chooseTimeZone({ current: DEFAULT, requested: undefined, addressChanged: true, detected: null }), {
    ...DEFAULT,
    detection: "failed",
  });
});

test("a zone chosen by hand survives a new address", () => {
  assert.deepEqual(chooseTimeZone({ current: MANUAL, requested: undefined, addressChanged: true, detected: "America/Cancun" }), {
    ...MANUAL,
    detection: "skipped",
  });
});
