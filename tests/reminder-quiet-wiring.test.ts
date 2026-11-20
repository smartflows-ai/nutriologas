// tests/reminder-quiet-wiring.test.ts
// Run: npx tsx --test tests/reminder-quiet-wiring.test.ts
// QA 2026-11-20: the reminder timing cannot be saved when a reminder would land inside the quiet hours. The card
// and the API run the same rule; the texts card (same route) is never blocked by it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/tenants/reminders/route.ts", "utf8");
const card = readFileSync("src/components/admin/ReminderSettingsCard.tsx", "utf8");

test("the API checks reminders against the quiet hours with the shared rule and answers reminder_in_quiet_hours", () => {
  assert.match(route, /reminderQuietConflict\(parseBusinessHours\(current\.businessHours\)/);
  assert.match(route, /apiError\("reminder_in_quiet_hours", 400\)/);
});

test("the API check runs only when the save touches the timing", () => {
  assert.match(route, /const touchesTiming =/);
  assert.match(route, /if \(touchesTiming\)/);
});

test("the GET answer carries the weekly hours for the card", () => {
  assert.match(route, /businessHours: parseBusinessHours\(businessHours\)/);
});

test("the card runs the same rule, shows the error and disables Save", () => {
  assert.match(card, /reminderQuietConflict\(/);
  assert.match(card, /tx\.reminderQuietConflict/);
  assert.match(card, /quietConflict === null/);
  assert.match(card, /disabled=\{saving \|\| !settingsValid\}/);
});
