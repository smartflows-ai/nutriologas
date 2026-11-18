// tests/time-zone-tag.test.ts
// Ticket #111: the [Zona horaria] / [Time zone] tag in the business's own texts, and the dates and times of the
// customer messages on the business clock.
// Run with: npx tsx --test tests/time-zone-tag.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { clinicLongDate, clinicTime, renderTemplate } from "../src/lib/reminder-messages";
import { templateIssues, type TemplateKind } from "../src/lib/reminder-template-rules";
import { timeZoneLabel } from "../src/lib/time-zones";

const VALUES = { servicio: "Consulta", fecha: "martes, 17 de noviembre", hora: "08:30 p.m.", negocio: "Clinica Ejemplo" };
const KINDS: TemplateKind[] = ["reminder", "confirmation", "cancellation"];

test("the time zone tag is a known tag in the three texts, in Spanish and English", () => {
  for (const kind of KINDS) {
    for (const tag of ["[Zona horaria]", "[Time zone]", "[ zona HORARIA ]"]) {
      const issues = templateIssues(`Tu cita es a las [Hora] (${tag}).`, kind);
      assert.ok(!issues.some((issue) => issue.code === "template_unknown_tag"), `${kind} ${tag}`);
    }
  }
});

test("the tag is filled with the zone as the customer reads it", () => {
  const es = renderTemplate("Tu cita es a las [Hora] ([Zona horaria]).", { ...VALUES, zona: timeZoneLabel("America/Cancun", "es") });
  assert.equal(es, "Tu cita es a las 08:30 p.m. (hora de Cancún).");
  const en = renderTemplate("Your visit is at [Time] ([Time zone]).", { ...VALUES, hora: "8:30 PM", zona: timeZoneLabel("America/Cancun", "en") });
  assert.equal(en, "Your visit is at 8:30 PM (Cancun time).");
});

test("the date and time of a message are read on the business clock", () => {
  const instant = new Date("2026-11-18T01:30:00Z");
  assert.match(clinicTime(instant, "es", "America/Mexico_City"), /^07:30\s?p\.\s?m\.$/);
  assert.match(clinicTime(instant, "es", "America/Cancun"), /^08:30\s?p\.\s?m\.$/);
  assert.equal(clinicTime(instant, "en", "America/Cancun"), "8:30 PM");
  assert.equal(clinicLongDate(instant, "es", "America/Mexico_City"), "martes, 17 de noviembre");
  // Madrid is already Wednesday.
  assert.equal(clinicLongDate(instant, "es", "Europe/Madrid"), "miércoles, 18 de noviembre");
});
