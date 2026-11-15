// tests/panel-appointments-core.test.ts
// Ticket #103: behavior of creating, editing and reopening visits from /admin/citas, with the database and the
// calendar replaced by fakes (I/O injected, like reminder-run). Covers roles, business hours, conflicts, the
// free times offered, the calendar warning, the email rule and the reopen rule.
// Run with: npx tsx --test tests/panel-appointments-core.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  createCore,
  editCore,
  reopenCore,
  type PanelDeps,
  type PanelProduct,
  type PanelTenant,
  type VisitRow,
} from "../src/lib/panel-appointments-core";

const NOW = new Date("2026-11-16T08:00:00-06:00"); // Monday
const AT_10 = "2026-11-16T10:00:00-06:00";
const AT_20 = "2026-11-16T20:00:00-06:00"; // outside the default hours (9 to 18)
const ALTERNATIVES = [{ date: "2026-11-16", time: "10:30", iso: "2026-11-16T10:30:00-06:00" }];

const TENANT: PanelTenant = {
  id: "t1",
  vertical: "HEALTH",
  isBookingEnabled: true,
  businessHours: null,
  serviceModes: "IN_PERSON",
  hasPhysicalLocation: true,
  address: "Calle 1",
};

const PRODUCT: PanelProduct = { id: "p1", name: "Consulta", durationMinutes: 30, requiresBooking: true, visitModes: null };

function visit(overrides: Partial<VisitRow> = {}): VisitRow {
  return {
    id: "v1",
    status: "PENDING",
    appointmentDate: new Date(AT_10),
    durationMinutes: 30,
    productId: "p1",
    customerName: "Luiz",
    customerPhone: "+525500000001",
    customerEmail: null,
    customerAge: 30,
    notes: null,
    modality: "IN_PERSON",
    petId: null,
    externalProvider: "GOOGLE",
    externalEventId: "evt-1",
    internalNotes: "nota clinica",
    ...overrides,
  };
}

interface Calls {
  created: Record<string, unknown>[];
  updated: { changes: Record<string, unknown>; checkConflicts: boolean }[];
  reopened: string[];
  eventsUpdated: { summary: string }[];
  eventsReplaced: number;
  freeSlots: { exclude?: unknown }[];
  guestPhones: string[];
}

function fakeDeps(overrides: Partial<PanelDeps> = {}): { deps: PanelDeps; calls: Calls } {
  const calls: Calls = { created: [], updated: [], reopened: [], eventsUpdated: [], eventsReplaced: 0, freeSlots: [], guestPhones: [] };
  const deps: PanelDeps = {
    findProduct: async (_t, id) => (id === "p1" ? PRODUCT : null),
    guestUserId: async (_t, phone) => {
      calls.guestPhones.push(phone);
      return "guest-1";
    },
    knownPatientName: async () => "Señora Prima",
    createVisit: async (input) => {
      calls.created.push(input as unknown as Record<string, unknown>);
      return { ok: true, appointment: visit({ id: "new", status: input.status, customerConfirmedAt: input.customerConfirmedAt ?? null } as Partial<VisitRow>) };
    },
    updateVisit: async (_t, v, changes, checkConflicts) => {
      calls.updated.push({ changes: changes as Record<string, unknown>, checkConflicts });
      return { ok: true, appointment: { ...v, ...changes } as VisitRow };
    },
    reopenVisit: async (_t, v, toStatus) => {
      calls.reopened.push(toStatus);
      return { ok: true, appointment: { ...v, status: toStatus, externalEventId: null } };
    },
    hasCalendar: async () => true,
    updateEvent: async (_t, _v, _r, text) => {
      calls.eventsUpdated.push(text);
      return true;
    },
    replaceEvent: async (_t, v) => {
      calls.eventsReplaced++;
      return { ...v, externalEventId: "evt-2" } as VisitRow;
    },
    reloadVisit: async (_t, id) => visit({ id }),
    freeSlots: async (input) => {
      calls.freeSlots.push({ exclude: input.exclude });
      return ALTERNATIVES;
    },
    petName: async () => null,
    editTenant: async () => TENANT,
    ...overrides,
  };
  return { deps, calls };
}

const createBody = (overrides: Record<string, unknown> = {}) => ({
  productId: "p1",
  appointmentDate: AT_10,
  clientName: "Luis",
  clientPhone: "+52 55 0000 0001",
  clientAge: "30",
  ...overrides,
});

// ── Create ───────────────────────────────────────────────────────────────────

test("staff books a free time: checked, pending, owned by the phone's guest account", async () => {
  const { deps, calls } = fakeDeps();
  const res = await createCore({ role: "STAFF", tenant: TENANT, body: createBody({ clientEmail: "luis@mail.com" }), now: NOW }, deps);
  assert.equal(res.status, 201);
  assert.equal(calls.created.length, 1);
  assert.equal(calls.created[0].checkConflicts, true);
  assert.equal(calls.created[0].status, "PENDING");
  assert.equal(calls.created[0].userId, "guest-1");
  assert.equal(calls.created[0].customerEmail, "luis@mail.com");
  assert.deepEqual(calls.guestPhones, ["+52 55 0000 0001"]);
});

test("the response to staff never carries clinical notes", async () => {
  const { deps } = fakeDeps();
  const res = await createCore({ role: "STAFF", tenant: TENANT, body: createBody(), now: NOW }, deps);
  assert.equal("internalNotes" in res.body, false);
});

test("staff cannot book outside business hours, even asking to override; the nearest free times come back", async () => {
  const { deps, calls } = fakeDeps();
  const res = await createCore({ role: "STAFF", tenant: TENANT, body: createBody({ appointmentDate: AT_20, override: true }), now: NOW }, deps);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "outside_business_hours");
  assert.deepEqual(res.body.alternatives, ALTERNATIVES);
  assert.equal(calls.created.length, 0);
});

test("the owner may book outside hours or on top of a visit only when asking to override", async () => {
  const { deps, calls } = fakeDeps();
  const res = await createCore({ role: "ADMIN", tenant: TENANT, body: createBody({ appointmentDate: AT_20, override: true }), now: NOW }, deps);
  assert.equal(res.status, 201);
  assert.equal(calls.created[0].checkConflicts, false);
});

test("a taken time answers 409 with the nearest free times", async () => {
  const { deps } = fakeDeps({ createVisit: async () => ({ ok: false }) });
  const res = await createCore({ role: "STAFF", tenant: TENANT, body: createBody(), now: NOW }, deps);
  assert.equal(res.status, 409);
  assert.equal(res.body.error, "slot_unavailable");
  assert.deepEqual(res.body.alternatives, ALTERNATIVES);
});

test("an unknown or not bookable service is refused", async () => {
  const missing = await createCore({ role: "ADMIN", tenant: TENANT, body: createBody({ productId: "nope" }), now: NOW }, fakeDeps().deps);
  assert.equal(missing.status, 404);
  const { deps } = fakeDeps({ findProduct: async () => ({ ...PRODUCT, requiresBooking: false }) });
  const physical = await createCore({ role: "ADMIN", tenant: TENANT, body: createBody(), now: NOW }, deps);
  assert.deepEqual([physical.status, physical.body.error], [400, "not_bookable"]);
});

test("'already confirmed' creates a confirmed visit with its confirmation time", async () => {
  const { deps, calls } = fakeDeps();
  await createCore({ role: "STAFF", tenant: TENANT, body: createBody({ alreadyConfirmed: true }), now: NOW }, deps);
  assert.equal(calls.created[0].status, "CONFIRMED");
  assert.equal((calls.created[0].customerConfirmedAt as Date).getTime(), NOW.getTime());
});

test("for another person: the visit is saved with that person's phone and the requester as 'recommended by'", async () => {
  const { deps, calls } = fakeDeps();
  await createCore(
    { role: "STAFF", tenant: TENANT, body: createBody({ forOtherPerson: true, requesterPhone: "+52 55 0000 0009" }), now: NOW },
    deps
  );
  assert.equal(calls.created[0].customerPhone, "+52 55 0000 0001");
  assert.equal(calls.created[0].referredByKey, "525500000009");
  assert.equal(calls.created[0].referredByName, "Señora Prima");
});

test("a pet business needs the pet's name; a both-modes service needs the modality", async () => {
  const pets = await createCore({ role: "STAFF", tenant: { ...TENANT, vertical: "VETERINARY" }, body: createBody(), now: NOW }, fakeDeps().deps);
  assert.deepEqual([pets.status, pets.body.error], [400, "pet_required"]);
  const both = await createCore({ role: "STAFF", tenant: { ...TENANT, serviceModes: "BOTH" }, body: createBody(), now: NOW }, fakeDeps().deps);
  assert.deepEqual([both.status, both.body.error], [400, "modality_required"]);
});

test("a connected calendar that got no event is reported, so the screen can warn", async () => {
  const { deps } = fakeDeps({
    createVisit: async () => ({ ok: true, appointment: visit({ id: "new", externalEventId: null }) }),
  });
  const res = await createCore({ role: "STAFF", tenant: TENANT, body: createBody(), now: NOW }, deps);
  assert.equal(res.body.calendarSynced, false);
  const noCalendar = fakeDeps({ hasCalendar: async () => false, createVisit: async () => ({ ok: true, appointment: visit({ externalEventId: null }) }) });
  const ok = await createCore({ role: "STAFF", tenant: TENANT, body: createBody(), now: NOW }, noCalendar.deps);
  assert.equal(ok.body.calendarSynced, true);
});

// ── Edit ─────────────────────────────────────────────────────────────────────

test("a cancelled or attended visit cannot be edited", async () => {
  const res = await editCore({ role: "ADMIN", tenantId: "t1", appointment: visit({ status: "CANCELLED" }), body: { clientName: "X" }, now: NOW }, fakeDeps().deps);
  assert.deepEqual([res.status, res.body.error], [400, "appointment_not_editable"]);
});

test("staff moving a visit onto a taken time gets 409 and free times that ignore the visit's own slot", async () => {
  const { deps, calls } = fakeDeps({ updateVisit: async () => ({ ok: false, reason: "slot_unavailable" }) });
  const res = await editCore(
    { role: "STAFF", tenantId: "t1", appointment: visit(), body: { appointmentDate: "2026-11-16T11:00:00-06:00", override: true }, now: NOW },
    deps
  );
  assert.equal(res.status, 409);
  assert.deepEqual(calls.freeSlots[0].exclude, { appointmentId: "v1", externalEventId: "evt-1" });
});

test("staff cannot move a visit outside business hours", async () => {
  const { deps, calls } = fakeDeps();
  const res = await editCore({ role: "STAFF", tenantId: "t1", appointment: visit(), body: { appointmentDate: AT_20, override: true }, now: NOW }, deps);
  assert.deepEqual([res.status, res.body.error], [400, "outside_business_hours"]);
  assert.equal(calls.updated.length, 0);
});

test("a name change updates only that field and the calendar event's text", async () => {
  const { deps, calls } = fakeDeps();
  const res = await editCore({ role: "STAFF", tenantId: "t1", appointment: visit(), body: { clientName: "Luis" }, now: NOW }, deps);
  assert.equal(res.status, 200);
  assert.deepEqual(calls.updated[0].changes, { customerName: "Luis" });
  assert.equal(calls.updated[0].checkConflicts, true);
  assert.match(calls.eventsUpdated[0].summary, /Luis/);
  assert.equal(calls.eventsReplaced, 0);
  assert.equal(res.body.calendarSynced, true);
});

test("a calendar that could not be updated is reported", async () => {
  const { deps } = fakeDeps({ updateEvent: async () => false });
  const res = await editCore({ role: "STAFF", tenantId: "t1", appointment: visit(), body: { clientName: "Luis" }, now: NOW }, deps);
  assert.equal(res.body.calendarSynced, false);
});

test("a modality change replaces the calendar event; a failed replace is reported with the real stored visit", async () => {
  const both = { ...PRODUCT, visitModes: "BOTH" as const };
  const ok = fakeDeps({ findProduct: async () => both });
  const res = await editCore({ role: "STAFF", tenantId: "t1", appointment: visit(), body: { modality: "ONLINE" }, now: NOW }, ok.deps);
  assert.equal(ok.calls.eventsReplaced, 1);
  assert.equal(res.body.calendarSynced, true);
  const failed = fakeDeps({ findProduct: async () => both, replaceEvent: async () => null, reloadVisit: async () => visit({ externalEventId: null }) });
  const res2 = await editCore({ role: "STAFF", tenantId: "t1", appointment: visit(), body: { modality: "ONLINE" }, now: NOW }, failed.deps);
  assert.equal(res2.body.calendarSynced, false);
  assert.equal(res2.body.externalEventId, null);
});

test("a new single-mode service sets its own modality", async () => {
  const online = { ...PRODUCT, id: "p2", visitModes: "ONLINE" as const };
  const { deps, calls } = fakeDeps({ findProduct: async (_t, id) => (id === "p2" ? online : PRODUCT) });
  await editCore({ role: "STAFF", tenantId: "t1", appointment: visit(), body: { productId: "p2" }, now: NOW }, deps);
  assert.equal(calls.updated[0].changes.modality, "ONLINE");
  assert.equal(calls.updated[0].changes.productId, "p2");
});

test("a visit deleted while it was being edited answers 404", async () => {
  const { deps } = fakeDeps({ updateVisit: async () => ({ ok: false, reason: "not_found" }) });
  const res = await editCore({ role: "STAFF", tenantId: "t1", appointment: visit(), body: { clientName: "Luis" }, now: NOW }, deps);
  assert.deepEqual([res.status, res.body.error], [404, "appointment_not_found"]);
});

// ── Reopen (owner decision of 2026-11-14) ────────────────────────────────────

test("reopening a past cancelled visit is refused", async () => {
  const res = await reopenCore({ tenantId: "t1", appointment: visit({ status: "CANCELLED", appointmentDate: new Date("2026-11-15T10:00:00-06:00") }), toStatus: "CONFIRMED", now: NOW }, fakeDeps().deps);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.result.body.error, "restore_window_closed");
});

test("reopening a future no-show onto a taken time is refused with free times, for every role", async () => {
  const { deps } = fakeDeps({ reopenVisit: async () => ({ ok: false, reason: "slot_unavailable" }) });
  const res = await reopenCore({ tenantId: "t1", appointment: visit({ status: "NO_SHOW" }), toStatus: "CONFIRMED", now: NOW }, deps);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.result.status, 409);
    assert.deepEqual(res.result.body.alternatives, ALTERNATIVES);
  }
});

test("reopening a future cancelled visit into a free slot brings its calendar event back", async () => {
  const { deps, calls } = fakeDeps();
  const res = await reopenCore({ tenantId: "t1", appointment: visit({ status: "CANCELLED", externalEventId: null }), toStatus: "CONFIRMED", now: NOW }, deps);
  assert.equal(res.ok, true);
  assert.deepEqual(calls.reopened, ["CONFIRMED"]);
  assert.equal(calls.eventsReplaced, 1);
});

test("a past no-show corrected by mistake is allowed without a slot check", async () => {
  const { deps, calls } = fakeDeps();
  const res = await reopenCore({ tenantId: "t1", appointment: visit({ status: "NO_SHOW", appointmentDate: new Date("2026-11-15T10:00:00-06:00") }), toStatus: "CONFIRMED", now: NOW }, deps);
  assert.equal(res.ok, true);
  assert.equal(calls.reopened.length, 0);
});

test("a status change that is not a reopen does nothing here", async () => {
  const { deps, calls } = fakeDeps();
  const res = await reopenCore({ tenantId: "t1", appointment: visit({ status: "PENDING" }), toStatus: "CONFIRMED", now: NOW }, deps);
  assert.equal(res.ok, true);
  assert.equal(calls.reopened.length + calls.eventsReplaced, 0);
});
