// tests/appointments-ui-wiring.test.ts
// Ticket #103: the /admin/citas screen shows each new action only to the roles that have it, keeps the tenant
// theme rules and never lets the phone of an existing visit be edited. Reads the source (no browser).
// Run with: npx tsx --test tests/appointments-ui-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8");
const PAGE = read("src/app/admin/citas/page.tsx");
const CARD = read("src/components/admin/appointments/AppointmentCard.tsx");
const FORM = read("src/components/admin/appointments/AppointmentFormPanel.tsx");
const HOOK = read("src/components/admin/appointments/useAppointmentForm.ts");

test("each new action is gated by its permission", () => {
  assert.match(PAGE, /useCan\("appointments\.book"\)/);
  assert.match(PAGE, /useCan\("appointments\.reschedule"\)/);
  assert.match(PAGE, /useCan\("appointments\.delete"\)/);
  assert.match(PAGE, /useCan\("appointments\.overbook"\)/);
  assert.match(PAGE, /canBook && isBookingEnabled &&/);
  assert.match(PAGE, /\.\.\.\(canDelete \? \[\{ id: "DELETED"/);
  assert.match(PAGE, /onDelete=\{canDelete \? setDeleting : undefined\}/);
});

test("only the owner gets the 'other time' option and the save-anyway step", () => {
  assert.match(FORM, /\{canOverbook && \(/);
  assert.match(HOOK, /setCanOverride\(canOverbook && !override\)/);
});

test("the phone of an existing visit is shown, never an input", () => {
  assert.match(FORM, /isEdit \? \(\s*<div className="md:col-span-2">\s*<p className=\{LABEL\}>\{t\.agenda\.form\.phone\}<\/p>/);
  // The edit body is built from the changed fields only and never carries the phone.
  const edit = HOOK.slice(HOOK.indexOf("const editBody"), HOOK.indexOf("const submit"));
  assert.ok(edit.length > 0, "editBody must exist before submit");
  assert.doesNotMatch(edit, /clientPhone/);
});

test("a deleted visit only offers Recuperar; calendar events get no edit or delete", () => {
  assert.match(CARD, /isDeleted \? \(\s*onRestore &&/);
  assert.match(CARD, /!isExternal && !isDeleted && \(onEdit \|\| onDelete\)/);
});

test("new primary buttons use the readable text color of the tenant theme", () => {
  for (const [name, src] of [["page", PAGE], ["card", CARD], ["form", FORM]] as const) {
    assert.doesNotMatch(src, /bg-primary[^"]*text-white/, name);
    assert.doesNotMatch(src, /btn-primary/, name);
  }
});

test("the screen texts come from the dictionaries", () => {
  for (const src of [CARD, FORM]) {
    assert.doesNotMatch(src, />\s*(Nueva cita|Eliminar|Recuperar|Guardar cita)\s*</);
  }
});
