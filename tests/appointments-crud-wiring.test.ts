// tests/appointments-crud-wiring.test.ts
// Ticket #103: the routes that create, edit, delete and restore visits from /admin/citas use the tested rules.
// Reads the source (no database), like tests/team-api-wiring.test.ts.
// Run with: npx tsx --test tests/appointments-crud-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");

const PANEL = read("src/lib/panel-appointments.ts");
// The behavior moved to an I/O-free core (tested with fakes in tests/panel-appointments-core.test.ts).
const CORE = read("src/lib/panel-appointments-core.ts");
const PATCH = read("src/app/api/appointments/[id]/route.ts");
const RESTORE = read("src/app/api/appointments/[id]/restore/route.ts");

test("a panel booking is validated, checked by role and never lands outside the rules", () => {
  assert.match(CORE, /parsePanelCreate\(input\.body, now\)/);
  assert.match(CORE, /scheduleChecksFor\(role, d\.override\)/);
  assert.match(CORE, /isBookable\(product, tenant\)/);
  assert.match(CORE, /checkConflicts: checks\.conflicts/);
  assert.match(CORE, /status: d\.alreadyConfirmed \? "CONFIRMED" : "PENDING"/);
  assert.match(CORE, /slotRefused\(deps, "slot_unavailable", 409/);
  assert.match(CORE, /slotRefused\(deps, "outside_business_hours", 400/);
  assert.match(PANEL, /createCore\(input, realPanelDeps\)/);
});

test("the tenant of a panel booking comes from the session, never from the body", () => {
  assert.doesNotMatch(CORE + PANEL, /body\.tenantId|d\.tenantId/);
  assert.match(read("src/app/api/appointments/route.ts"), /where: tenantId\s*\? \{ id: tenantId \}/);
});

test("an edit refuses the phone first, then runs the panel rules", () => {
  const phone = PATCH.indexOf("findNonEditableField(body)");
  const edit = PATCH.indexOf("editFromPanel({");
  assert.ok(phone > 0 && phone < edit, "the phone must be refused before an edit runs");
  assert.match(CORE, /isEditableStatus\(appointment\.status\)/);
  assert.match(CORE, /deps\.updateVisit\(tenantId, appointment, changes, checks\.conflicts\)/);
  assert.doesNotMatch(PATCH, /checkConflicts: false/);
});

test("every return to an active status goes through the reopen rule (owner decision of 2026-11-14)", () => {
  assert.match(PATCH, /if \(managesAgenda\) \{\s*const reopened = await reopenFromPanel\(\{ tenantId, appointment, toStatus: status, now \}\)/);
  assert.match(CORE, /reopenPlanFor\(String\(appointment\.status\), input\.toStatus, appointment\.appointmentDate, now\)/);
  assert.match(read("src/lib/appointments-panel-service.ts"), /export async function reopenVisit/);
});

test("writes after a lookup skip a visit deleted in between (security review S2)", () => {
  const service = read("src/lib/appointments-panel-service.ts");
  assert.equal((service.match(/updateMany\(\{\s*where: \{ id: visit\.id, tenantId, deletedAt: null \}/g) ?? []).length >= 3, true);
  assert.match(PATCH, /updateMany\(\{\s*where: \{ id: params\.id, tenantId, deletedAt: null \}/);
  assert.match(read("src/lib/appointments-service.ts"), /const hidden = await lockDay\(tenantId, dateKeyInClinicZone\(appointment\.appointmentDate, zone\)/);
});

test("panel bookings are rate limited per user", () => {
  assert.match(read("src/app/api/appointments/route.ts"), /rateLimited\(`panel-book:\$\{tenant\.id\}/);
});

test("the Confirmar button sends the shared confirmation text, not a fixed Spanish one", () => {
  assert.match(PATCH, /ownerConfirmationText\(\{/);
  assert.doesNotMatch(PATCH, /CONFIRMADA|👋|🩺|toLocaleDateString\("es-MX"/);
  assert.match(read("src/lib/reminder-actions.ts"), /export function ownerConfirmationText/);
});

test("delete is a soft delete for the owner and staff, and restore needs the same permission", () => {
  assert.match(PATCH, /requirePermission\("appointments\.delete"\)/);
  assert.match(PATCH, /softDeleteAppointment\(tenantId, appointment/);
  assert.match(RESTORE, /requirePermission\("appointments\.delete"\)/);
  assert.match(RESTORE, /restoreAppointment\(\{/);
  assert.match(RESTORE, /slotRefused\(code, status/);
});

test("the services list for the form carries no price", () => {
  const src = read("src/app/api/appointments/services/route.ts");
  assert.match(src, /requirePermission\("appointments\.book"\)/);
  assert.doesNotMatch(src, /price(Mode)?: true/);
  assert.doesNotMatch(src, /\bprice: p\./);
});

test("the known-patient lookup is permission checked, business scoped and rate limited", () => {
  const src = read("src/app/api/appointments/known-patient/route.ts");
  assert.match(src, /requirePermission\("appointments\.book"\)/);
  assert.match(src, /rateLimited\(`known-patient:\$\{tenantId\}/);
  assert.match(src, /getKnownPatient\(tenantId, key\)/);
});

test("availability only skips a visit's own slot for a panel session of the same business", () => {
  const src = read("src/app/api/appointments/availability/route.ts");
  assert.match(src, /session\.user\.tenantId !== tenantId/);
  assert.match(src, /can\(session\.user\.role, "appointments\.book"\)/);
});

test("the bot's 'slot taken' answer offers the nearest free times", () => {
  for (const rel of ["src/app/api/internal/bot/book/route.ts", "src/app/api/internal/bot/reschedule/route.ts"]) {
    const src = read(rel);
    assert.match(src, /botSlotTakenBody\(\{/, rel);
    assert.doesNotMatch(src, /"Ese horario (ya )?no está disponible\."/, rel);
  }
});
