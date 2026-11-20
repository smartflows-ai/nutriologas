// tests/wa-risk-card-wiring.test.ts
// The business send switch in WhatsAppRiskCard is a checkbox row, like the reminders card on the same screen:
// the label on the left, the control on the right, saved on change. Reads the source, no database.
// Run: npx tsx --test tests/wa-risk-card-wiring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const CARD = readFileSync(path.join(ROOT, "src/components/admin/WhatsAppRiskCard.tsx"), "utf8").replace(/\r\n/g, "\n");
const ES = readFileSync(path.join(ROOT, "src/i18n/es.ts"), "utf8");
const EN = readFileSync(path.join(ROOT, "src/i18n/en.ts"), "utf8");
const TYPES = readFileSync(path.join(ROOT, "src/i18n/types.ts"), "utf8");

test("the business send switch is a checkbox row, not a button", () => {
  assert.match(CARD, /type="checkbox"/);
  assert.match(CARD, /checked=\{!data\.businessKillSwitch\}/);
  assert.match(CARD, /onChange=\{toggleBusiness\}/);
  assert.doesNotMatch(CARD, /<button[^>]*onClick=\{toggleBusiness\}/, "the switch is not a button");
  assert.doesNotMatch(CARD, /aria-pressed/);
});

test("the row label is the business sends label, and the resume button keeps the shared primary class", () => {
  assert.match(CARD, /\{w\.businessSends\}/);
  assert.match(CARD, /"btn-primary"/);
  assert.doesNotMatch(CARD, /businessPauseAction|businessResumeAction/);
});

test("the label exists in the types and in both dictionaries, and the old action labels are gone", () => {
  assert.match(TYPES, /businessSends: string/);
  assert.match(ES, /businessSends: "/);
  assert.match(EN, /businessSends: "/);
  assert.doesNotMatch(TYPES + ES + EN, /businessPauseAction|businessResumeAction/);
});
