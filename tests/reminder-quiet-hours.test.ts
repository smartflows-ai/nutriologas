// tests/reminder-quiet-hours.test.ts
// Run: npx tsx --test tests/reminder-quiet-hours.test.ts
// QA 2026-11-20: the reminder settings cannot be saved when, with the business's weekly hours, a reminder would go
// out inside the quiet hours.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderQuietConflict } from "../src/lib/reminder-quiet-hours";
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from "../src/lib/business-hours";

const QUIET_START = 21 * 60;
const QUIET_END = 8 * 60;
const CLOSED: BusinessHours = { sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] };

test("24 h before a 09:00-18:00 schedule lands at 09:00-18:00: no conflict", () => {
  assert.equal(reminderQuietConflict(DEFAULT_BUSINESS_HOURS, 24 * 60, QUIET_START, QUIET_END), null);
});

test("12 h before a 09:00 visit lands at 21:00: conflict with the first example", () => {
  const conflict = reminderQuietConflict(DEFAULT_BUSINESS_HOURS, 12 * 60, QUIET_START, QUIET_END);
  assert.deepEqual(conflict, { visitMin: 9 * 60, reminderMin: 21 * 60 });
});

test("2 h before a 09:00 visit lands at 07:00: conflict", () => {
  const conflict = reminderQuietConflict(DEFAULT_BUSINESS_HOURS, 2 * 60, QUIET_START, QUIET_END);
  assert.deepEqual(conflict, { visitMin: 9 * 60, reminderMin: 7 * 60 });
});

test("1 h before a 09:00 visit lands at 08:00, the end of the window: no conflict", () => {
  assert.equal(reminderQuietConflict(DEFAULT_BUSINESS_HOURS, 60, QUIET_START, QUIET_END), null);
});

test("the last visits of a day count: 1 h before a 22:00 visit lands at 21:00", () => {
  const hours: BusinessHours = { ...CLOSED, monday: [{ start: "09:00", end: "23:00" }] };
  assert.deepEqual(reminderQuietConflict(hours, 60, QUIET_START, QUIET_END), { visitMin: 22 * 60, reminderMin: 21 * 60 });
});

test("a block that ends at the quiet start is fine: 1 h before visits up to 21:59 lands by 20:59", () => {
  const hours: BusinessHours = { ...CLOSED, monday: [{ start: "09:00", end: "22:00" }] };
  assert.equal(reminderQuietConflict(hours, 60, QUIET_START, QUIET_END), null);
});

test("a late block is checked too (visit at 22:30, 24 h before = 22:30)", () => {
  const hours: BusinessHours = { ...CLOSED, friday: [{ start: "20:00", end: "23:00" }] };
  const conflict = reminderQuietConflict(hours, 24 * 60, QUIET_START, QUIET_END);
  assert.deepEqual(conflict, { visitMin: 21 * 60, reminderMin: 21 * 60 });
});

test("an empty quiet window (start equals end) never conflicts", () => {
  assert.equal(reminderQuietConflict(DEFAULT_BUSINESS_HOURS, 12 * 60, 0, 0), null);
});

test("a closed business has no visits, so no conflict", () => {
  assert.equal(reminderQuietConflict(CLOSED, 12 * 60, QUIET_START, QUIET_END), null);
});

test("leads over a day wrap the clock (36 h before 09:00 = 21:00)", () => {
  const conflict = reminderQuietConflict(DEFAULT_BUSINESS_HOURS, 36 * 60, QUIET_START, QUIET_END);
  assert.deepEqual(conflict, { visitMin: 9 * 60, reminderMin: 21 * 60 });
});
