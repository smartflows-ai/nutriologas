// Waiting for confirmation = active visit, reminder sent, no customerConfirmedAt, not released. The Confirmar button
// in Citas now records customerConfirmedAt, so such a visit leaves the list. CONFIRMED stays allowed because the
// bot creates its bookings CONFIRMED before the customer answers.
// Run: npx tsx --test tests/confirmations-list.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AWAITING_CONFIRMATION } from "../src/lib/reminders";

const API = path.join(__dirname, "..", "src", "app", "api", "apps", "whatsapp", "confirmations");
const LIST = readFileSync(path.join(API, "route.ts"), "utf8");
const ACTION = readFileSync(path.join(API, "[id]", "route.ts"), "utf8");

test("waiting for confirmation means: active visit, reminder sent, nobody confirmed, not released", () => {
  assert.deepEqual(AWAITING_CONFIRMATION, {
    status: { in: ["PENDING", "CONFIRMED"] },
    reminderSentAt: { not: null },
    customerConfirmedAt: null,
    autoReleasedAt: null,
  });
});

test("the Confirmations list and its actions use that one rule", () => {
  for (const [name, src] of [["list", LIST], ["action", ACTION]] as const) {
    assert.match(src, /\.\.\.AWAITING_CONFIRMATION\b/, `${name} route spreads AWAITING_CONFIRMATION`);
    assert.doesNotMatch(src, /customerConfirmedAt: null/, `${name} route has no filter of its own`);
  }
});
