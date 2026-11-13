// The owner's name tag ([Nombre del médico] / [Owner name]) fills with the business owner's name, and it disappears
// cleanly when the business has no owner name, like [Nombre] does for the customer.
// Run: npx tsx --test tests/reminder-owner-tag.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, type ReminderValues } from "../src/lib/reminder-messages";
import { LABEL_TO_KEY, templateIssues } from "../src/lib/reminder-template-rules";

const BASE: ReminderValues = { servicio: "Consulta", fecha: "martes, 3 de noviembre", hora: "10:00 a. m.", negocio: "Doctor G Center", nombre: "Ana Torres", responsable: "Dr. Gonzalo Soto" };

test("the owner tag is known in Spanish and English", () => {
  assert.equal(LABEL_TO_KEY.get("nombre del médico"), "responsable");
  assert.equal(LABEL_TO_KEY.get("owner name"), "responsable");
});

test("the owner tag fills with the owner's name", () => {
  assert.equal(renderTemplate("Te atenderá [Nombre del médico].", BASE), "Te atenderá Dr. Gonzalo Soto.");
});

test("without an owner name the tag disappears and the sentence still reads", () => {
  const out = renderTemplate("Te atenderá [Nombre del médico] hoy.", { ...BASE, responsable: null });
  assert.equal(out, "Te atenderá hoy.");
});

test("a template with the owner tag is valid", () => {
  assert.deepEqual(templateIssues("Hola [Nombre], te atiende [Nombre del médico].", "reminder"), []);
});

test("with no owner name configured the tag is removed and the reminder keeps its other data", () => {
  const out = renderTemplate("Hola [Nombre], te atiende [Nombre del médico].\nFecha: [Fecha]", { ...BASE, responsable: "" });
  assert.equal(out, "Hola Ana, te atiende.\nFecha: martes, 3 de noviembre");
  assert.ok(!out.includes("["));
});

test("a bold owner tag with no owner name leaves no stray asterisks", () => {
  const out = renderTemplate("Tienes cita con el *[Owner name]*.\n\n*[Owner name]*  \nGracias.", { ...BASE, responsable: null });
  assert.ok(!out.includes("*"), out);
  assert.ok(!out.includes("**"), out);
});

test("without an owner name the article before the tag goes too, so no sentence ends in 'con el.'", () => {
  const sin = { ...BASE, responsable: null };
  assert.equal(renderTemplate("Te recordamos que tienes una cita programada con el *[Owner name]*.", sin), "Te recordamos que tienes una cita programada.");
  assert.equal(renderTemplate("Queremos confirmar tu próxima cita con el *[Owner name]*.", sin), "Queremos confirmar tu próxima cita.");
  assert.equal(renderTemplate("Tu cita con la [Nombre del médico] fue cancelada.", sin), "Tu cita fue cancelada.");
  // Subject position keeps the old behavior: the tag goes, the sentence keeps its own words.
  assert.equal(renderTemplate("Te atenderá [Nombre del médico] hoy.", sin), "Te atenderá hoy.");
  // With a name the article stays: nothing changes.
  assert.equal(renderTemplate("Tienes cita con el *[Owner name]*.", BASE), "Tienes cita con el *Dr. Gonzalo Soto*.");
});
