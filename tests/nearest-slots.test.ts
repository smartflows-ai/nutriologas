// tests/nearest-slots.test.ts
// Ticket #103 (D10): when a time is taken a second earlier, the reply offers the nearest free times instead of a
// bare "not available". Pure function, no database.
// Run with: npx tsx --test tests/nearest-slots.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { ALTERNATIVES_OFFERED, nearestSlots, type SlotRef } from "../src/lib/nearest-slots";

const day = (time: string, date = "2026-11-17"): SlotRef => ({ date, time });

test("three alternatives are offered by default", () => {
  assert.equal(ALTERNATIVES_OFFERED, 3);
});

test("the nearest free times around the wanted one come back in time order", () => {
  const free = ["09:00", "09:30", "10:30", "11:00", "11:30", "12:00"].map((t) => day(t));
  // 9:30 and 10:30 are 30 minutes away; 9:00 and 11:00 tie at 60 and the earlier one wins.
  assert.deepEqual(nearestSlots(free, day("10:00")), [day("09:00"), day("09:30"), day("10:30")]);
  const later = ["09:30", "10:30", "11:00"].map((t) => day(t));
  assert.deepEqual(nearestSlots(later, day("10:00")), [day("09:30"), day("10:30"), day("11:00")]);
});

test("on a tie the earlier time wins", () => {
  const free = ["09:00", "11:00"].map((t) => day(t));
  assert.deepEqual(nearestSlots(free, day("10:00"), 1), [day("09:00")]);
});

test("the wanted time itself is never offered back", () => {
  const free = ["10:00", "10:30"].map((t) => day(t));
  assert.deepEqual(nearestSlots(free, day("10:00")), [day("10:30")]);
});

test("free times of the next days count, by real distance", () => {
  const free = [day("17:30"), day("09:00", "2026-11-18"), day("09:30", "2026-11-18")];
  assert.deepEqual(nearestSlots(free, day("17:00")), [day("17:30"), day("09:00", "2026-11-18"), day("09:30", "2026-11-18")]);
});

test("fewer free times than asked returns what there is, and none returns an empty list", () => {
  assert.deepEqual(nearestSlots([day("12:00")], day("10:00")), [day("12:00")]);
  assert.deepEqual(nearestSlots([], day("10:00")), []);
});

test("the input list is not changed", () => {
  const free = [day("11:00"), day("09:00")];
  const copy = free.map((s) => ({ ...s }));
  nearestSlots(free, day("10:00"));
  assert.deepEqual(free, copy);
});
