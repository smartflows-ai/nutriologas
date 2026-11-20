// tests/reactivate-confirm-wiring.test.ts
// "Reactivar mensajes" is confirmed inside the screen, with a checkbox like "Reanudar envíos" in the risk card.
// A native confirm() dialog blocks the browser tab and does not match the rest of the screens. Reads the source.
// Run: npx tsx --test tests/reactivate-confirm-wiring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const PAGE = readFileSync(path.join(ROOT, "src/app/admin/whatsapp/page.tsx"), "utf8").replace(/\r\n/g, "\n");
const ES = readFileSync(path.join(ROOT, "src/i18n/es.ts"), "utf8");
const EN = readFileSync(path.join(ROOT, "src/i18n/en.ts"), "utf8");
const TYPES = readFileSync(path.join(ROOT, "src/i18n/types.ts"), "utf8");

test("the reactivate action does not open a native confirm dialog", () => {
  assert.doesNotMatch(PAGE, /confirm\(t\.crm\.whatsapp\.help\.reactivateConfirm\)/);
});

test("the opt-out band has a checkbox that must be ticked before the reactivate button works", () => {
  assert.match(PAGE, /reactivateChecked/);
  assert.match(PAGE, /type="checkbox"/);
  assert.match(PAGE, /disabled=\{helpBusy \|\| !reactivateChecked\}/);
});

test("the checkbox label exists in the types and in both dictionaries", () => {
  assert.match(TYPES, /reactivateCheck: string/);
  assert.match(ES, /reactivateCheck: "/);
  assert.match(EN, /reactivateCheck: "/);
});
