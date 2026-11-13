// A text that uses a tag whose data is empty (owner name, business location) cannot be saved: the owner gets an error
// that names the field to fill. The customer name and the visit times are per visit, so they are not checked here.
// Run: npx tsx --test tests/reminder-unfilled-fields.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { unfilledFields } from "../src/lib/reminder-template-rules";

const FULL = { ownerName: "Dr. Gonzalo Soto", hasLocation: true };

test("a text with the owner tag and no owner name reports the owner field", () => {
  assert.deepEqual(unfilledFields("Te atiende [Nombre del médico].", { ...FULL, ownerName: null }), ["responsable"]);
  assert.deepEqual(unfilledFields("Te atiende [Owner name].", { ...FULL, ownerName: "   " }), ["responsable"]);
});

test("a blank owner name counts as empty, a filled one does not", () => {
  assert.deepEqual(unfilledFields("Te atiende [Nombre del médico].", FULL), []);
});

test("a text with the location tag and no business location reports the location field", () => {
  assert.deepEqual(unfilledFields("Ubicación: [Ubicación]", { ...FULL, hasLocation: false }), ["ubicacion"]);
});

test("texts without these tags never report anything", () => {
  assert.deepEqual(unfilledFields("Hola [Nombre], tu cita en [Nombre del negocio].", { ownerName: null, hasLocation: false }), []);
});

test("both fields are reported when both are used and empty", () => {
  assert.deepEqual(unfilledFields("[Nombre del médico] en [Ubicación]", { ownerName: null, hasLocation: false }), ["responsable", "ubicacion"]);
});
