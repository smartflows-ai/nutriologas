// tests/visit-notes.test.ts
// Ticket #103 (D3d): the clinical note of a deleted visit stays visible in the patient history, marked as coming
// from a deleted visit, instead of disappearing with the visit. Pure function, no database.
// Run with: npx tsx --test tests/visit-notes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { splitVisitNotes } from "../src/lib/visit-notes";

const note = (id: string, appointmentId: string | null) => ({ id, appointmentId, body: `nota ${id}` });

test("a note of a visit that is not deleted stays attached to that visit", () => {
  const { byVisit, orphans } = splitVisitNotes([note("n1", "v1")], new Set());
  assert.equal(byVisit.get("v1")?.id, "n1");
  assert.deepEqual(orphans, []);
});

test("a note without a visit is shown on its own, not as from a deleted visit", () => {
  const { orphans } = splitVisitNotes([note("n2", null)], new Set());
  assert.deepEqual(orphans, [{ ...note("n2", null), fromDeletedVisit: false }]);
});

test("a note of a deleted visit is shown on its own, marked as from a deleted visit", () => {
  const { byVisit, orphans } = splitVisitNotes([note("n3", "v-deleted")], new Set(["v-deleted"]));
  assert.equal(byVisit.size, 0);
  assert.deepEqual(orphans, [{ ...note("n3", "v-deleted"), fromDeletedVisit: true }]);
});

test("a note of a visit that is only filtered out of the view (another pet) is not treated as deleted", () => {
  const { byVisit, orphans } = splitVisitNotes([note("n4", "v-other-pet")], new Set(["v-deleted"]));
  assert.equal(byVisit.get("v-other-pet")?.id, "n4");
  assert.deepEqual(orphans, []);
});

test("a later note of the same visit wins, as before", () => {
  const { byVisit } = splitVisitNotes([note("newer", "v1"), note("older", "v1")], new Set());
  assert.equal(byVisit.get("v1")?.id, "older");
});

test("the order of the notes shown on their own is kept", () => {
  const notes = [note("a", null), note("b", "v-deleted"), note("c", "v1"), note("d", null)];
  const { orphans } = splitVisitNotes(notes, new Set(["v-deleted"]));
  assert.deepEqual(
    orphans.map((n) => n.id),
    ["a", "b", "d"]
  );
});

test("the input notes are not changed", () => {
  const notes = [note("n1", "v-deleted")];
  splitVisitNotes(notes, new Set(["v-deleted"]));
  assert.deepEqual(notes, [note("n1", "v-deleted")]);
});
