// Owner alert when the WhatsApp bot could not answer a customer: the cooldown is consumed only by an alert that was sent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OWNER_ALERT_COOLDOWN_MS, shouldAlertOwner } from "../src/lib/owner-alert";

const NOW = new Date("2026-11-17T18:00:00.000Z");

test("the cooldown is 60 minutes", () => {
  assert.equal(OWNER_ALERT_COOLDOWN_MS, 60 * 60 * 1000);
});

test("the owner is alerted when no alert was ever sent", () => {
  assert.equal(shouldAlertOwner(NOW, null), true);
});

test("no second alert within the cooldown", () => {
  const lastAlert = new Date(NOW.getTime() - 59 * 60 * 1000);
  assert.equal(shouldAlertOwner(NOW, lastAlert), false);
});

test("a new alert is allowed exactly when the cooldown has passed", () => {
  const lastAlert = new Date(NOW.getTime() - OWNER_ALERT_COOLDOWN_MS);
  assert.equal(shouldAlertOwner(NOW, lastAlert), true);
});

test("the route records the cooldown only after the owner was notified", () => {
  const source = readFileSync("src/app/api/internal/bot/alert-failure/route.ts", "utf8");
  const sendAt = source.indexOf("notifyTenantOwner(");
  const markAt = source.indexOf("botFailureAlertedAt: new Date()");
  assert.ok(sendAt > 0 && markAt > 0, "route must send the alert and mark the cooldown");
  assert.ok(markAt > sendAt, "the cooldown must be written after the send, not before");
  assert.ok(source.includes("shouldAlertOwner("), "the route must use the shared cooldown rule");
});
