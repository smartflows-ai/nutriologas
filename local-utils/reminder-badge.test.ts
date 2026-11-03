// Ticket #16, phase 2: when /admin/citas shows the "reminder not delivered" badge.
// Run: npx tsx --test local-utils/reminder-badge.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { reminderNotDelivered } from "../src/lib/reminder-badge";

const base = { status: "PENDING", reminderSentAt: null, reminderAttempts: 2 };

test("shows for an active visit whose reminder failed and was never sent", () => {
  assert.equal(reminderNotDelivered(base), true);
  assert.equal(reminderNotDelivered({ ...base, status: "CONFIRMED" }), true);
});

test("hidden once the reminder was sent, even if earlier attempts failed", () => {
  assert.equal(reminderNotDelivered({ ...base, reminderSentAt: "2026-11-02T18:00:00.000Z" }), false);
});

test("hidden when there were no failed attempts", () => {
  assert.equal(reminderNotDelivered({ ...base, reminderAttempts: 0 }), false);
});

test("hidden for visits that no longer need a reminder", () => {
  for (const status of ["CANCELLED", "COMPLETED", "NO_SHOW"]) {
    assert.equal(reminderNotDelivered({ ...base, status }), false, status);
  }
});

test("hidden for calendar events that are not native appointments (fields missing)", () => {
  assert.equal(reminderNotDelivered({ status: "CONFIRMED" }), false);
});

const NOW = new Date("2026-11-02T18:00:00.000Z");

test("shown while the visit is still in the future", () => {
  assert.equal(reminderNotDelivered({ ...base, appointmentDate: "2026-11-03T15:00:00.000Z" }, NOW), true);
});

test("hidden once the visit time has passed, because no more retries happen", () => {
  assert.equal(reminderNotDelivered({ ...base, appointmentDate: "2026-11-02T17:59:00.000Z" }, NOW), false);
  assert.equal(reminderNotDelivered({ ...base, appointmentDate: "2026-11-02T18:00:00.000Z" }, NOW), false);
});

test("a visit without a date is judged only by its status and attempts", () => {
  assert.equal(reminderNotDelivered(base, NOW), true);
});
