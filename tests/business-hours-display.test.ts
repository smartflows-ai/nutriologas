// Regression: the storefront homepage must show the same weekly schedule the admin saves in /admin/negocio.
import test from "node:test";
import assert from "node:assert/strict";
import { weeklyScheduleRows, parseBusinessHours } from "../src/lib/business-hours";

test("lists the week Monday first with the saved blocks and Sunday closed", () => {
  const rows = weeklyScheduleRows(parseBusinessHours(null));
  assert.deepEqual(rows.map((r) => r.weekday), ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  assert.deepEqual(rows[0].blocks, [{ start: "09:00", end: "18:00" }]);
  assert.deepEqual(rows[6].blocks, []);
});

test("keeps several blocks of one day (lunch break)", () => {
  const hours = { ...parseBusinessHours(null), monday: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] };
  assert.equal(weeklyScheduleRows(hours)[0].blocks.length, 2);
});

import { daySlots } from "../src/lib/business-hours";

const MONDAY = "2026-11-02";

test("every service steps by its own duration, so a 120 minute service starts at 09, 11, 13 and 15", () => {
  const hours = parseBusinessHours(null);
  assert.deepEqual(daySlots(hours, MONDAY, 120), ["09:00", "11:00", "13:00", "15:00"]);
  assert.deepEqual(daySlots(hours, MONDAY, 90), ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"]);
});

test("a long service never crosses a lunch break", () => {
  const hours = { ...parseBusinessHours(null), monday: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] };
  assert.deepEqual(daySlots(hours, MONDAY, 120), ["09:00", "11:00", "14:00", "16:00"]);
});

test("services of 60 minutes or less keep stepping by their own duration", () => {
  const hours = parseBusinessHours(null);
  assert.equal(daySlots(hours, MONDAY, 60).length, 9);
  assert.deepEqual(daySlots(hours, MONDAY, 30).slice(0, 3), ["09:00", "09:30", "10:00"]);
});

import { markSlots } from "../src/lib/business-hours";

test("markSlots keeps every candidate in order and flags the ones that are not free", () => {
  const marked = markSlots(["09:00", "10:00", "11:00"], ["10:00"]);
  assert.deepEqual(marked, [
    { time: "09:00", available: false },
    { time: "10:00", available: true },
    { time: "11:00", available: false },
  ]);
});

test("markSlots ignores free times that are not candidates", () => {
  assert.deepEqual(markSlots(["09:00"], ["09:00", "23:00"]), [{ time: "09:00", available: true }]);
});
