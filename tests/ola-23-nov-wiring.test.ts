// tests/ola-23-nov-wiring.test.ts
// Reads the source (no database) to check the routes use the shared rules of the 23-nov wave
// (tickets #128, #127, #74, #129 and the readable text on the primary color). Run with:
// npx tsx --test tests/ola-23-nov-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

test("bot/context shows the patient through contextPatientView, so a name without a surname is asked (#128)", () => {
  const src = read("src/app/api/internal/bot/context/route.ts");
  assert.match(src, /patient: contextPatientView\(known\)/);
  assert.doesNotMatch(src, /name: known\.name/);
  assert.match(src, /intake: intakeNeeds\(known\)/);
});

test("saving a new zone that shifts booked visits needs the owner's confirmation, on the server (#127)", () => {
  const src = read("src/app/api/tenants/business/route.ts");
  assert.match(src, /confirmZoneShift: z\.boolean\(\)\.optional\(\)/);
  assert.match(src, /parsed\.data\.confirmZoneShift !== true/);
  assert.match(src, /loadZoneShift\(tenantId, zone\.timeZone\)/);
  assert.match(src, /apiErrorWith\("time_zone_shift_unconfirmed", 409/);
});

test("the zone impact reads only future active visits of the session's business (#127)", () => {
  const data = read("src/lib/time-zone-change-data.ts");
  assert.match(data, /deletedAt: null/);
  assert.match(data, /status: \{ in: \["PENDING", "CONFIRMED"\] \}/);
  assert.match(data, /appointmentDate: \{ gt: now \}/);
  for (const rel of ["src/app/api/tenants/business/time-zone-impact/route.ts", "src/app/api/tenants/business/time-zone-check/route.ts"]) {
    const route = read(rel);
    assert.match(route, /session\.user\.role !== "ADMIN"/, rel);
    assert.match(route, /session\.user\.tenantId/, rel);
  }
});

test("/admin/negocio shows the shifted visits and sends the owner's confirmation (#127)", () => {
  const page = read("src/app/admin/negocio/page.tsx");
  assert.match(page, /useZoneShift\(savedTimeZone, timeZone\)/);
  assert.match(page, /<TimeZoneShiftReview /);
  assert.match(page, /<TimeZoneMismatchNotice/);
  assert.match(page, /confirmZoneShift: zoneShiftConfirmed/);
});

test("every confirmation the customer gets carries the place of an in person visit (#74)", () => {
  const confirm = read("src/app/api/internal/bot/confirm/route.ts");
  assert.match(confirm, /withLocation\(confirmed, appointment, tenant \? placeTextOf\(tenant\) : null, language\)/);
  assert.match(confirm, /\.\.\.TENANT_PLACE_SELECT/);
  for (const rel of ["src/app/api/apps/whatsapp/confirmations/[id]/route.ts", "src/app/api/appointments/[id]/route.ts"]) {
    const src = read(rel);
    assert.match(src, /\.\.\.TENANT_PLACE_SELECT/, rel);
    assert.match(src, /locationText: placeTextOf\(/, rel);
  }
  const actions = read("src/lib/reminder-actions.ts");
  assert.match(actions, /locationText: placeTextOf\(row\.tenant\)/);
});

test("two periods after a tag are checked on save, not at send time (#74)", () => {
  const card = read("src/components/admin/ReminderMessagesCard.tsx");
  assert.match(card, /saveIssues\(settings\.confirmationTemplate\.trim\(\), "confirmation"\)/);
  assert.doesNotMatch(card, /templateIssues\(/);
  assert.match(read("src/app/api/tenants/reminders/route.ts"), /validatePunctuation\(text\)/);
  assert.doesNotMatch(read("src/lib/reminder-messages.ts"), /punctuationIssues|saveIssues/);
});
