// tests/appointment-calendar-text.test.ts
// Text of the calendar event created for an appointment: title, details and where the visit happens.
// Run with: npx tsx --test tests/appointment-calendar-text.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendarText, modalityLabel } from "../src/lib/appointment-calendar-text";

const base = {
  serviceName: "Colposcopia",
  customerName: "Ana Lopez",
  reason: null,
  fallbackReason: "Cita agendada por WhatsApp",
  phone: "528446683688",
  age: null,
  modality: null,
};

test("the title names the service and the patient", () => {
  assert.equal(buildCalendarText(base).summary, "Cita: Colposcopia - Ana Lopez");
  assert.equal(buildCalendarText({ ...base, customerName: null }).summary, "Cita: Colposcopia - Paciente");
  assert.equal(buildCalendarText({ ...base, petName: "Max" }).summary, "Cita: Colposcopia - Ana Lopez (Max)");
});

test("without modality or age the details stay as before", () => {
  const { description } = buildCalendarText(base);
  assert.equal(description, "Cita agendada por WhatsApp\nTel: 528446683688\nPaciente: Ana Lopez");
});

test("age and modality are added as their own lines", () => {
  const { description } = buildCalendarText({ ...base, age: 31, modality: "ONLINE", reason: "Revision anual" });
  assert.equal(
    description,
    "Revision anual\nTel: 528446683688\nPaciente: Ana Lopez\nEdad: 31 años\nModalidad: En línea"
  );
  assert.match(buildCalendarText({ ...base, modality: "IN_PERSON" }).description, /Modalidad: Presencial$/);
});

test("modality has a label in Spanish and English, and none when unknown", () => {
  assert.equal(modalityLabel("IN_PERSON", "es"), "Presencial");
  assert.equal(modalityLabel("ONLINE", "es"), "En línea");
  assert.equal(modalityLabel("IN_PERSON", "en"), "In person");
  assert.equal(modalityLabel("ONLINE", "en"), "Online");
  assert.equal(modalityLabel(null, "es"), null);
});
