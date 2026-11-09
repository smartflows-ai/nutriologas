// tests/location-line-text.test.ts
// An in-person visit gets the business address (with a directions link) in the WhatsApp reminder; an online visit
// gets the video call link instead, never both.
// Run with: npx tsx --test tests/location-line-text.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { withLocation } from "../src/lib/reminder-messages";
import { runReminderBatch, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";

const PLACE = "Av. Reforma 100, CDMX (https://www.google.com/maps/dir/?api=1&destination=19.4,-99.1)";

test("an in person visit gets the location under the message, in the business language", () => {
  assert.equal(withLocation("Recordatorio", { modality: "IN_PERSON" }, PLACE, "es"), `Recordatorio\n\nUbicación: ${PLACE}`);
  assert.equal(withLocation("Reminder", { modality: "IN_PERSON" }, PLACE, "en"), `Reminder\n\nLocation: ${PLACE}`);
});

test("visits from before the modality existed are in person", () => {
  assert.equal(withLocation("Hola", { modality: null }, PLACE, "es"), `Hola\n\nUbicación: ${PLACE}`);
  assert.equal(withLocation("Hola", {}, PLACE, "es"), `Hola\n\nUbicación: ${PLACE}`);
});

test("online visits and businesses without a physical location keep the message as it is", () => {
  assert.equal(withLocation("Hola", { modality: "ONLINE" }, PLACE, "es"), "Hola");
  assert.equal(withLocation("Hola", { modality: "IN_PERSON" }, "", "es"), "Hola");
  assert.equal(withLocation("Hola", { modality: "IN_PERSON" }, null, "es"), "Hola");
  assert.equal(withLocation("Hola", { modality: "IN_PERSON" }, undefined, "es"), "Hola");
});

const NOW = new Date("2026-11-02T18:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function visit(overrides: Partial<ReminderVisit>, locationText: string | null): ReminderVisit {
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
    tenant: {
      name: "Clinica",
      messageLanguage: "es",
      reminderLeadMinutes: 24 * 60,
      confirmationRequired: true,
      confirmationDeadlineMinutes: 120,
      reminderTemplate: null,
      confirmationTemplate: null,
      cancellationTemplate: null,
      locationText,
    },
    ...overrides,
  };
}

async function sentTexts(v: ReminderVisit): Promise<string[]> {
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
  return texts;
}

test("the reminder job sends the address of an in person visit", async () => {
  const [text] = await sentTexts(visit({ modality: "IN_PERSON" }, PLACE));
  assert.ok(text.includes(`Ubicación: ${PLACE}`));
  assert.ok(text.indexOf("Ubicación") < text.indexOf("Responde *SI*"), "the address comes before the request to reply");
  assert.ok(text.trimEnd().endsWith("libre."), "the request to reply closes the message");
  assert.ok(!text.includes("Videollamada"));
});

test("the reminder job sends the video call link, not the address, of an online visit", async () => {
  const [text] = await sentTexts(visit({ modality: "ONLINE", meetUrl: "https://meet.google.com/abc-defg-hij" }, PLACE));
  assert.ok(text.includes("Videollamada: https://meet.google.com/abc-defg-hij"));
  assert.ok(!text.includes("Ubicación"));
});

test("the reminder job sends no location line when the business has no physical location", async () => {
  const [text] = await sentTexts(visit({ modality: "IN_PERSON" }, ""));
  assert.ok(!text.includes("Ubicación"));
});
