// The reminder run sends ONE message per visit. A confirmation text that already names the visit is that whole
// message: the reminder text is not sent above it (same greeting and details twice).
// Run: npx tsx --test tests/reminder-single-message.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { runReminderBatch, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-11T12:06:00.000Z");

const REMINDER = "Hola *[Customer name]*.\n\nTe recordamos que tienes una cita en *[Business name]*.\n\n📋 *Servicio:* [Service]\n🕒 *Hora:* [Time]\n📍 *Ubicación:* [Location]\n\nSerá un gusto atenderte.";
const CONFIRMATION =
  "Hola *[Customer name]*.\n\nQueremos confirmar tu próxima cita en *[Business name]*.\n\n📋 *Servicio:* [Service]\n🕒 *Hora:* [Time]\n\n¿Nos confirmas tu asistencia?\n\nResponde *SI* antes de las *[Deadline time]*.\n\nGracias.";

function visit(overrides: Partial<ReminderVisit> = {}, tenant: Partial<ReminderVisit["tenant"]> = {}): ReminderVisit {
  return {
    id: "a1",
    tenantId: "t1",
    customerPhone: "525500000001",
    customerName: "Scarllet Johansson",
    appointmentDate: new Date(NOW.getTime() + 3 * HOUR),
    createdAt: new Date(NOW.getTime() - 48 * HOUR),
    reminderSentAt: null,
    reminderAttempts: 0,
    customerConfirmedAt: null,
    autoReleasedAt: null,
    externalProvider: null,
    externalEventId: null,
    productName: "Colposcopía",
    modality: "IN_PERSON",
    tenant: {
      name: "Doctor G Center",
      messageLanguage: "es",
      reminderLeadMinutes: 180,
      confirmationRequired: true,
      confirmationDeadlineMinutes: 60,
      reminderTemplate: REMINDER,
      confirmationTemplate: CONFIRMATION,
      cancellationTemplate: null,
      locationText: "Edificio Vantash 702, Monterrey",
      ...tenant,
    },
    ...overrides,
  };
}

async function sentText(v: ReminderVisit): Promise<string> {
  const texts: string[] = [];
  const deps: ReminderDeps = {
    send: async (_visit, text) => {
      texts.push(text);
      return { success: true };
    },
    markSent: async () => undefined,
    recordFailure: async () => undefined,
    charge: async () => undefined,
    release: async () => ({ customerNotified: true }),
  };
  await runReminderBatch([v], NOW, deps, { dryRun: false });
  assert.equal(texts.length, 1);
  return texts[0];
}

test("a confirmation text that names the visit is sent alone, without the reminder text above it", async () => {
  const text = await sentText(visit());
  assert.ok(text.includes("Queremos confirmar tu próxima cita"));
  assert.ok(!text.includes("Te recordamos"));
  assert.ok(!text.includes("Serán un gusto") && !text.includes("Será un gusto"));
  assert.equal(text.match(/Hola /g)?.length, 1);
  assert.equal(text.match(/Servicio/g)?.length, 1);
});

test("the address goes right after the visit details, and the request to reply stays below it", async () => {
  const text = await sentText(visit());
  const hora = text.indexOf("Hora:");
  const place = text.indexOf("Ubicación: Edificio Vantash 702, Monterrey");
  const ask = text.indexOf("¿Nos confirmas");
  assert.ok(hora >= 0 && place > hora && ask > place);
});

test("an online visit gets its video call link after the details", async () => {
  const text = await sentText(visit({ modality: "ONLINE", meetUrl: "https://meet.google.com/abc-defg-hij" }));
  assert.ok(text.includes("Videollamada: https://meet.google.com/abc-defg-hij"));
  assert.ok(!text.includes("Ubicación:"));
});

test("an online visit with no link yet gets no empty place line", async () => {
  const text = await sentText(visit({ modality: "ONLINE", meetUrl: null }));
  assert.ok(!text.includes("Ubicación"));
  assert.ok(!text.includes("Videollamada"));
});

test("a confirmation text with its own location tag is not given the place a second time", async () => {
  const own = CONFIRMATION.replace("🕒 *Hora:* [Time]", "🕒 *Hora:* [Time]\n📍 [Location]");
  const text = await sentText(visit({}, { confirmationTemplate: own }));
  assert.equal(text.match(/Edificio Vantash 702/g)?.length, 1);
});

test("the default confirmation text is only the request, so it still goes under the reminder", async () => {
  const text = await sentText(visit({}, { reminderTemplate: null, confirmationTemplate: null }));
  assert.ok(text.includes("Recordatorio de tu cita"));
  assert.ok(text.includes("Responde *SI*"));
});

test("a visit already confirmed gets the reminder text with its footer, not the confirmation text", async () => {
  const text = await sentText(visit({ customerConfirmedAt: new Date(NOW.getTime() - HOUR) }));
  assert.ok(text.includes("Te recordamos"));
  assert.ok(!text.includes("Queremos confirmar"));
});

test("the closing period of the deadline sentence is not doubled after a.m. or p.m.", async () => {
  const text = await sentText(visit());
  assert.ok(!text.includes(".."));
});
