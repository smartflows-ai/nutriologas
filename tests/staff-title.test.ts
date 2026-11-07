// Tests for the STAFF role name per business vertical (ticket #21, phase 7).
// Run: npx tsx --test local-utils/staff-title.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getVerticalProfile, type StaffTitle } from "../src/lib/vertical-profile";
import { es } from "../src/i18n/es";
import { en } from "../src/i18n/en";

const EXPECTED: Readonly<Record<string, StaffTitle>> = {
  HEALTH: "assistant",
  TOURISM: "guide",
  TRAVEL: "guide",
  VETERINARY: "staff",
  PET_CARE: "staff",
  SERVICES: "staff",
  ECOMMERCE: "staff",
  GENERAL: "staff",
};

for (const [vertical, title] of Object.entries(EXPECTED)) {
  test(`${vertical} calls STAFF "${title}"`, () => {
    assert.equal(getVerticalProfile(vertical, true).staffTitle, title);
  });
}

test("unknown or missing verticals use the generic staff title", () => {
  assert.equal(getVerticalProfile(undefined, true).staffTitle, "staff");
  assert.equal(getVerticalProfile("SOMETHING_NEW", false).staffTitle, "staff");
});

test("every title has a label in Spanish and English", () => {
  assert.deepEqual(es.staffUi.titles, { assistant: "Asistente", guide: "Guía", staff: "Personal" });
  assert.deepEqual(en.staffUi.titles, { assistant: "Assistant", guide: "Guide", staff: "Staff" });
});

test("the sidebar shows the title under the name only for STAFF, from i18n (no hardcoded text)", () => {
  const sidebar = readFileSync(path.join(__dirname, "..", "src", "components", "admin", "AdminSidebar.tsx"), "utf8");
  assert.match(sidebar, /t\.staffUi\.titles\[profile\.staffTitle\]/);
  assert.match(sidebar, /role === STAFF_ROLE/);
});
