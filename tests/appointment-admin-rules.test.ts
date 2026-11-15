// tests/appointment-admin-rules.test.ts
// Ticket #103: rules for creating, editing, deleting and restoring visits from /admin/citas.
// Pure functions, no database.
// Run with: npx tsx --test tests/appointment-admin-rules.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarEffectOf,
  findNonEditableField,
  isEditableStatus,
  parsePanelCreate,
  parseNotesField,
  parsePanelEdit,
  reopenPlanFor,
  restoreCheck,
  scheduleChecksFor,
  trailRoleOf,
  type CalendarFields,
} from "../src/lib/appointment-admin-rules";

const NOW = new Date("2026-11-16T15:00:00-06:00");
const FUTURE = "2026-11-17T10:00:00-06:00";
const PAST = "2026-11-16T09:00:00-06:00";

function createBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    productId: "svc-1",
    appointmentDate: FUTURE,
    clientName: "  Luis Pérez  ",
    clientPhone: "+52 844 668 3688",
    clientAge: "34",
    ...overrides,
  };
}

// ── scheduleChecksFor ────────────────────────────────────────────────────────

test("staff is always checked for business hours and conflicts, even when it asks to override", () => {
  assert.deepEqual(scheduleChecksFor("STAFF", false), { hours: true, conflicts: true });
  assert.deepEqual(scheduleChecksFor("STAFF", true), { hours: true, conflicts: true });
});

test("the owner is checked unless the request explicitly asks to override", () => {
  assert.deepEqual(scheduleChecksFor("ADMIN", false), { hours: true, conflicts: true });
  assert.deepEqual(scheduleChecksFor("ADMIN", true), { hours: false, conflicts: false });
});

test("any other role is always checked", () => {
  for (const role of ["CUSTOMER", "", null, undefined]) {
    assert.deepEqual(scheduleChecksFor(role, true), { hours: true, conflicts: true }, String(role));
  }
});

// ── isEditableStatus ─────────────────────────────────────────────────────────

test("only pending and confirmed visits can be edited", () => {
  assert.equal(isEditableStatus("PENDING"), true);
  assert.equal(isEditableStatus("CONFIRMED"), true);
  for (const s of ["COMPLETED", "CANCELLED", "NO_SHOW", "", "pending"]) assert.equal(isEditableStatus(s), false, s);
});

// ── findNonEditableField ─────────────────────────────────────────────────────

test("the phone is never editable, under any of its names", () => {
  assert.equal(findNonEditableField({ clientPhone: "+52 1" }), "clientPhone");
  assert.equal(findNonEditableField({ customerPhone: "+52 1" }), "customerPhone");
  assert.equal(findNonEditableField({ patientPhone: "+52 1" }), "patientPhone");
});

test("the service, the date and the patient details are editable", () => {
  assert.equal(
    findNonEditableField({ productId: "svc-2", appointmentDate: FUTURE, clientName: "Ana", clientAge: 30, notes: "x" }),
    null
  );
});

// ── parsePanelCreate ─────────────────────────────────────────────────────────

test("a complete panel booking is accepted and cleaned", () => {
  const result = parsePanelCreate(createBody({ clientEmail: " Luis@Mail.com ", notes: "  dolor  " }), NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.clientName, "Luis Pérez");
  assert.equal(result.data.clientAge, 34);
  assert.equal(result.data.clientEmail, "luis@mail.com");
  assert.equal(result.data.notes, "dolor");
  assert.equal(result.data.alreadyConfirmed, false);
  assert.equal(result.data.override, false);
  assert.equal(result.data.requesterPhone, null);
  assert.equal(result.data.appointmentDate.toISOString(), new Date(FUTURE).toISOString());
});

test("an empty email and empty notes become null", () => {
  const result = parsePanelCreate(createBody({ clientEmail: "  ", notes: "" }), NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.clientEmail, null);
  assert.equal(result.data.notes, null);
});

test("a missing service or date is refused", () => {
  assert.deepEqual(parsePanelCreate(createBody({ productId: "" }), NOW), { ok: false, error: "service_and_date_required" });
  assert.deepEqual(parsePanelCreate(createBody({ appointmentDate: undefined }), NOW), {
    ok: false,
    error: "service_and_date_required",
  });
});

test("an unreadable date is refused, and a past one too", () => {
  assert.deepEqual(parsePanelCreate(createBody({ appointmentDate: "mañana" }), NOW), { ok: false, error: "date_invalid" });
  assert.deepEqual(parsePanelCreate(createBody({ appointmentDate: PAST }), NOW), { ok: false, error: "date_in_past" });
});

test("name, phone and age are required (D7: age is required from the panel too)", () => {
  assert.deepEqual(parsePanelCreate(createBody({ clientName: "   " }), NOW), { ok: false, error: "name_required" });
  assert.deepEqual(parsePanelCreate(createBody({ clientPhone: "12" }), NOW), { ok: false, error: "phone_required" });
  assert.deepEqual(parsePanelCreate(createBody({ clientAge: "" }), NOW), { ok: false, error: "age_required" });
  assert.deepEqual(parsePanelCreate(createBody({ clientAge: 121 }), NOW), { ok: false, error: "age_required" });
});

test("a malformed email is refused", () => {
  assert.deepEqual(parsePanelCreate(createBody({ clientEmail: "luis@" }), NOW), { ok: false, error: "email_invalid" });
});

test("a modality must be in person or online when sent", () => {
  const online = parsePanelCreate(createBody({ modality: "ONLINE" }), NOW);
  assert.equal(online.ok && online.data.modality, "ONLINE");
  const none = parsePanelCreate(createBody({ modality: "" }), NOW);
  assert.equal(none.ok && none.data.modality, null);
  assert.deepEqual(parsePanelCreate(createBody({ modality: "PHONE" }), NOW), { ok: false, error: "validation_failed" });
});

test("the 'already confirmed' checkbox and the owner override are read as booleans", () => {
  const result = parsePanelCreate(createBody({ alreadyConfirmed: true, override: true }), NOW);
  assert.equal(result.ok && result.data.alreadyConfirmed, true);
  assert.equal(result.ok && result.data.override, true);
});

test("a booking for another person needs the requester's phone, and it must be a different number", () => {
  const ok = parsePanelCreate(createBody({ forOtherPerson: true, requesterPhone: "+52 844 111 2222" }), NOW);
  assert.equal(ok.ok && ok.data.requesterPhone, "+52 844 111 2222");
  assert.deepEqual(parsePanelCreate(createBody({ forOtherPerson: true, requesterPhone: "" }), NOW), {
    ok: false,
    error: "requester_phone_required",
  });
  // The same number written another way is the same person.
  assert.deepEqual(parsePanelCreate(createBody({ forOtherPerson: true, requesterPhone: "528446683688" }), NOW), {
    ok: false,
    error: "other_person_same_phone",
  });
});

test("a requester phone sent without 'for another person' is ignored", () => {
  const result = parsePanelCreate(createBody({ requesterPhone: "+52 844 111 2222" }), NOW);
  assert.equal(result.ok && result.data.requesterPhone, null);
});

test("pet fields are kept as typed, empty ones become null", () => {
  const result = parsePanelCreate(createBody({ petName: " Max ", petSpecies: "dog" }), NOW);
  assert.equal(result.ok && result.data.petName, "Max");
  assert.equal(result.ok && result.data.petSpecies, "dog");
  const none = parsePanelCreate(createBody(), NOW);
  assert.equal(none.ok && none.data.petName, null);
});

test("a body that is not an object is refused", () => {
  assert.deepEqual(parsePanelCreate(null, NOW), { ok: false, error: "service_and_date_required" });
  assert.deepEqual(parsePanelCreate("x", NOW), { ok: false, error: "service_and_date_required" });
});

// ── parsePanelEdit ───────────────────────────────────────────────────────────

test("an edit carries only the fields that were sent", () => {
  const result = parsePanelEdit({ clientName: " Ana ", clientAge: 40 }, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, { clientName: "Ana", clientAge: 40, override: false });
});

test("an edit that sends the phone is refused", () => {
  assert.deepEqual(parsePanelEdit({ clientPhone: "+52 844 668 3688" }, NOW), { ok: false, error: "field_not_editable" });
});

test("an edit validates each sent field like a booking", () => {
  assert.deepEqual(parsePanelEdit({ clientName: "" }, NOW), { ok: false, error: "name_required" });
  assert.deepEqual(parsePanelEdit({ clientAge: "abc" }, NOW), { ok: false, error: "age_required" });
  assert.deepEqual(parsePanelEdit({ clientEmail: "no" }, NOW), { ok: false, error: "email_invalid" });
  assert.deepEqual(parsePanelEdit({ appointmentDate: PAST }, NOW), { ok: false, error: "date_in_past" });
  assert.deepEqual(parsePanelEdit({ productId: "" }, NOW), { ok: false, error: "service_and_date_required" });
});

test("an edit may clear the email and the reason", () => {
  const result = parsePanelEdit({ clientEmail: "", notes: "  " }, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.clientEmail, null);
  assert.equal(result.data.notes, null);
});

test("an edit with a new date and service keeps both", () => {
  const result = parsePanelEdit({ appointmentDate: FUTURE, productId: "svc-2", override: true }, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.productId, "svc-2");
  assert.equal(result.data.appointmentDate?.toISOString(), new Date(FUTURE).toISOString());
  assert.equal(result.data.override, true);
});

// ── calendarEffectOf ─────────────────────────────────────────────────────────

const BEFORE: CalendarFields = {
  appointmentDate: new Date(FUTURE),
  durationMinutes: 30,
  productId: "svc-1",
  customerName: "Luiz",
  customerAge: 34,
  notes: "dolor",
  modality: "IN_PERSON",
  customerEmail: null,
};

test("no change leaves the calendar event alone", () => {
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE }), "none");
});

test("a new time, duration, service, name, age or reason updates the event", () => {
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE, appointmentDate: new Date("2026-11-17T11:00:00-06:00") }), "update");
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE, durationMinutes: 60, productId: "svc-2" }), "update");
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE, customerName: "Luis" }), "update");
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE, customerAge: 35 }), "update");
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE, notes: null }), "update");
});

test("a new modality or email recreates the event (video link, address or guest change)", () => {
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE, modality: "ONLINE" }), "recreate");
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE, customerEmail: "luis@mail.com" }), "recreate");
  assert.equal(calendarEffectOf(BEFORE, { ...BEFORE, modality: "ONLINE", customerName: "Luis" }), "recreate");
});

// ── trailRoleOf ──────────────────────────────────────────────────────────────

test("only the owner and staff can be written to the delete / restore history", () => {
  assert.equal(trailRoleOf("ADMIN"), "ADMIN");
  assert.equal(trailRoleOf("STAFF"), "STAFF");
  for (const role of ["CUSTOMER", "", null, undefined, "admin"]) assert.equal(trailRoleOf(role), null, String(role));
});

// ── restoreCheck and reopen (D14 to D17) ─────────────────────────────────────

test("a deleted visit can be restored until its start time", () => {
  assert.deepEqual(restoreCheck({ appointmentDate: new Date("2026-11-16T15:30:00-06:00") }, NOW), { ok: true });
});

test("a deleted visit whose start time has come cannot be restored", () => {
  const closed = { ok: false, error: "restore_window_closed" };
  assert.deepEqual(restoreCheck({ appointmentDate: NOW }, NOW), closed);
  assert.deepEqual(restoreCheck({ appointmentDate: new Date(PAST) }, NOW), closed);
});

// Owner decision of 2026-11-14 (security review): every return to an active status follows the restore rules.
const FUTURE_AT = new Date("2026-11-16T15:30:00-06:00");
const PAST_AT = new Date(PAST);

test("a status change that is not a reopen needs nothing", () => {
  assert.equal(reopenPlanFor("PENDING", "CONFIRMED", FUTURE_AT, NOW), "none");
  assert.equal(reopenPlanFor("CONFIRMED", "COMPLETED", FUTURE_AT, NOW), "none");
  assert.equal(reopenPlanFor("CANCELLED", "CANCELLED", FUTURE_AT, NOW), "none");
  assert.equal(reopenPlanFor("NO_SHOW", "CANCELLED", FUTURE_AT, NOW), "none");
});

test("reopening a future visit from cancelled, no-show or attended checks its slot for everyone", () => {
  for (const from of ["CANCELLED", "NO_SHOW", "COMPLETED"]) {
    assert.equal(reopenPlanFor(from, "CONFIRMED", FUTURE_AT, NOW), "check_slot", from);
    assert.equal(reopenPlanFor(from, "PENDING", FUTURE_AT, NOW), "check_slot", from);
  }
});

test("a cancelled visit whose time has come cannot be reopened", () => {
  assert.equal(reopenPlanFor("CANCELLED", "CONFIRMED", PAST_AT, NOW), "window_closed");
});

test("a past no-show or attended visit can be corrected without a slot check (no reminder, no event)", () => {
  assert.equal(reopenPlanFor("NO_SHOW", "CONFIRMED", PAST_AT, NOW), "allow");
  assert.equal(reopenPlanFor("COMPLETED", "CONFIRMED", PAST_AT, NOW), "allow");
});

// ── Input limits (security review S4, S7) ────────────────────────────────────

test("an email longer than 254 characters is refused", () => {
  const long = `${"a".repeat(250)}@x.co`;
  assert.deepEqual(parsePanelCreate(createBody({ clientEmail: long }), NOW), { ok: false, error: "email_invalid" });
});

test("a date more than a year ahead is refused", () => {
  assert.deepEqual(parsePanelCreate(createBody({ appointmentDate: "2027-12-01T10:00:00-06:00" }), NOW), {
    ok: false,
    error: "date_too_far",
  });
  assert.deepEqual(parsePanelEdit({ appointmentDate: "2027-12-01T10:00:00-06:00" }, NOW), { ok: false, error: "date_too_far" });
});

test("oversized ids and phones are refused", () => {
  assert.deepEqual(parsePanelCreate(createBody({ productId: "x".repeat(65) }), NOW), { ok: false, error: "validation_failed" });
  assert.deepEqual(parsePanelCreate(createBody({ clientPhone: `+52 ${"5".repeat(40)}` }), NOW), { ok: false, error: "phone_required" });
  assert.deepEqual(
    parsePanelCreate(createBody({ forOtherPerson: true, requesterPhone: `+52 ${"4".repeat(40)}` }), NOW),
    { ok: false, error: "requester_phone_required" }
  );
});

test("the notes rule is shared: empty is null, text is trimmed, too long or not text is refused", () => {
  assert.deepEqual(parseNotesField(""), { ok: true, data: null });
  assert.deepEqual(parseNotesField("  hola  "), { ok: true, data: "hola" });
  assert.deepEqual(parseNotesField(null), { ok: true, data: null });
  assert.deepEqual(parseNotesField("x".repeat(2001)), { ok: false, error: "validation_failed" });
  assert.deepEqual(parseNotesField(42), { ok: false, error: "validation_failed" });
});
