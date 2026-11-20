// tests/panel-visit-notices-wiring.test.ts
// Holes 1, 4 and 5: the panel tells the patient about a cancellation or a move, and the agenda shows the permission.
// Reads the source (no database). Run: npx tsx --test tests/panel-visit-notices-wiring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel: string) => read(rel).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

test("cancelling from the panel notifies the patient, through the policy, with a fixed key", () => {
  const route = code("src/app/api/appointments/[id]/route.ts");
  assert.match(route, /status === "CANCELLED"[\s\S]{0,200}notifyCancelledFromPanel\(/);
  const actions = code("src/lib/reminder-actions.ts");
  assert.match(actions, /export async function notifyCancelledFromPanel/);
  assert.match(actions, /idempotencyKey: `cancel:\$\{visitId\}`/);
  assert.match(actions, /purpose: "TRANSACTIONAL"/);
});

test("moving a visit from the panel tells the patient the new time, keyed by that time", () => {
  const route = code("src/app/api/appointments/[id]/route.ts");
  assert.match(route, /body\.appointmentDate !== undefined[\s\S]{0,120}notifyMovedFromPanel\(/);
  const actions = code("src/lib/reminder-actions.ts");
  assert.match(actions, /idempotencyKey: `move:\$\{visitId\}:\$\{visit\.appointmentDate\.toISOString\(\)\}`/);
});

test("the agenda sends each visit's WhatsApp permission", () => {
  const agenda = code("src/app/api/appointments/route.ts");
  assert.match(agenda, /whatsappPermission: whatsappPermissionOf\(/);
  assert.match(agenda, /optedOutAt: \{ not: null \}/);
});

test("the card shows the permission badge with an icon and a word", () => {
  const card = code("src/components/admin/appointments/AppointmentCard.tsx");
  assert.match(card, /needsPermissionBadge\(/);
  assert.match(card, /ShieldAlert size=/);
  assert.match(card, /t\.crm\.waRisk\.noPermissionBadge/);
  assert.match(card, /t\.crm\.waRisk\.optedOutBadge/);
});
