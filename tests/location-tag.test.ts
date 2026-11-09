// tests/location-tag.test.ts
// The [Ubicación] tag lets a business place the address (in person) or the video call link (online) itself, in the
// reminder or the confirmation text. When a text uses it, the automatic line is not added a second time.
// Run with: npx tsx --test tests/location-tag.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { placeText, renderTemplate, validateKnownTags, validateNoLocationTag } from "../src/lib/reminder-messages";
import { hasLocationTag, templateIssues, templateProblem } from "../src/lib/reminder-template-rules";
import { runReminderBatch, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";

const PLACE = "Av. Reforma 100, CDMX (https://www.google.com/maps/dir/?api=1&destination=19.4,-99.1)";
const MEET = "https://meet.google.com/abc-defg-hij";
const BASE = { servicio: "Consulta", fecha: "martes", hora: "12:00 p.m.", negocio: "Clinica" };

test("the tag is a known tag in Spanish and English, ignoring case and spaces", () => {
  assert.equal(validateKnownTags("Te esperamos en [Ubicación]"), null);
  assert.equal(validateKnownTags("See you at [Location]"), null);
  assert.equal(validateKnownTags("Te esperamos en [ UBICACIÓN ]"), null);
  assert.equal(hasLocationTag("Te esperamos en [Ubicación]"), true);
  assert.equal(hasLocationTag("Te esperamos"), false);
});

test("the tag is valid in the reminder and the confirmation text, not in the cancellation text", () => {
  assert.equal(templateProblem("Te esperamos en [Ubicación]", "reminder"), null);
  assert.equal(templateProblem("En [Ubicación]. Responde SI antes de las [Hora límite].", "confirmation"), null);
  assert.deepEqual(templateIssues("Cancelada en [Ubicación]", "cancellation"), [
    { code: "template_location_not_allowed", fragments: ["[Ubicación]"] },
  ]);
  assert.equal(validateNoLocationTag("Cancelada en [Location]"), "template_location_not_allowed");
  assert.equal(validateNoLocationTag("Cancelada"), null);
});

test("the tag becomes the address of an in person visit and the link of an online one", () => {
  assert.equal(placeText({ modality: "IN_PERSON" }, PLACE), PLACE);
  assert.equal(placeText({ modality: null }, PLACE), PLACE);
  assert.equal(placeText({ modality: "ONLINE", meetUrl: MEET }, PLACE), MEET);
  assert.equal(placeText({ modality: "ONLINE", meetUrl: null }, PLACE), "");
  assert.equal(placeText({ modality: "ONLINE", meetUrl: "http://example.com" }, PLACE), "");
  assert.equal(placeText({ modality: "IN_PERSON" }, ""), "");
  assert.equal(placeText({ modality: "IN_PERSON" }, null), "");
});

test("renderTemplate fills the tag, and closes the gap when there is nothing to show", () => {
  assert.equal(renderTemplate("Te esperamos en [Ubicación].", { ...BASE, ubicacion: PLACE }), `Te esperamos en ${PLACE}.`);
  assert.equal(renderTemplate("Conéctate aquí [Ubicación] gracias", { ...BASE, ubicacion: "" }), "Conéctate aquí gracias");
});

const NOW = new Date("2026-11-02T18:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function visit(templates: { reminderTemplate?: string | null; confirmationTemplate?: string | null }, extra: Partial<ReminderVisit> = {}): ReminderVisit {
  return {
    id: "a1",
    tenantId: "t1",
    customerPhone: "525500000001",
    customerName: null,
    appointmentDate: new Date(NOW.getTime() + 23 * HOUR),
    createdAt: new Date(NOW.getTime() - 48 * HOUR),
    reminderSentAt: null,
    reminderAttempts: 0,
    customerConfirmedAt: null,
    autoReleasedAt: null,
    externalProvider: null,
    externalEventId: null,
    productName: "Consulta",
    modality: "IN_PERSON",
    tenant: {
      name: "Clinica",
      messageLanguage: "es",
      reminderLeadMinutes: 24 * 60,
      confirmationRequired: true,
      confirmationDeadlineMinutes: 120,
      reminderTemplate: templates.reminderTemplate ?? null,
      confirmationTemplate: templates.confirmationTemplate ?? null,
      cancellationTemplate: null,
      locationText: PLACE,
    },
    ...extra,
  };
}

async function sentText(v: ReminderVisit): Promise<string> {
  const texts: string[] = [];
  const deps: ReminderDeps = {
    send: async (_v, text) => {
      texts.push(text);
      return { success: true };
    },
    markSent: async () => {},
    recordFailure: async () => {},
    charge: async () => {},
    release: async () => ({ customerNotified: true }),
  };
  await runReminderBatch([v], NOW, deps, { dryRun: false });
  return texts[0];
}

function countOf(text: string, part: string): number {
  return text.split(part).length - 1;
}

test("a reminder text with the tag shows the address once, where the business put it", async () => {
  const text = await sentText(visit({ reminderTemplate: "Te esperamos en [Ubicación]." }));
  assert.equal(countOf(text, "Av. Reforma 100"), 1);
  assert.ok(text.startsWith(`Te esperamos en ${PLACE}.`));
  assert.ok(!text.includes("Ubicación:"), "no automatic line when the text places it");
});

test("a confirmation text with the tag also stops the automatic line", async () => {
  const text = await sentText(visit({ confirmationTemplate: "Estamos en [Ubicación]. Responde SI antes de las [Hora límite]." }));
  assert.equal(countOf(text, "Av. Reforma 100"), 1);
  assert.ok(!text.includes("Ubicación:"));
});

test("an online visit puts the video call link where the tag is", async () => {
  const text = await sentText(visit({ reminderTemplate: "Entra aquí: [Ubicación]" }, { modality: "ONLINE", meetUrl: MEET }));
  assert.equal(countOf(text, MEET), 1);
  assert.ok(!text.includes("Videollamada:"));
  assert.ok(!text.includes("Av. Reforma"));
});

test("without the tag the automatic line is still added", async () => {
  const text = await sentText(visit({ reminderTemplate: "Recordatorio de tu cita." }));
  assert.ok(text.includes(`Ubicación: ${PLACE}`));
});
