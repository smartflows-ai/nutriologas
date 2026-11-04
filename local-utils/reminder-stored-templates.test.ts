// Ticket #16 defect: texts saved before the save-time checks existed (or by any other path) must never reach a
// customer with raw tags in brackets. At send time an invalid stored text falls back to the language default.
// Run: npx tsx --test local-utils/reminder-stored-templates.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cancellationText, customerTexts, usableTemplate, validateReminderNoConfirmation } from "../src/lib/reminder-messages";
import { runReminderBatch, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-02T18:00:00.000Z");

// The three texts found in production (business name replaced by a generic one).
const STORED_REMINDER =
  "Recordatorio de tu cita en [Nombre del negocio].\n\nServicio: [Servicio]\nFecha: [Fecha]\nHora: [Hora]\n\n¿Confirmas tu cita? Responde SI para confirmarla. Si no la confirmas antes de las [Hora límite]., se cancelará y el horario quedará libre.";
const STORED_CONFIRMATION =
  "Hola [Nombre], te esperamos en [Nombre del negocio] para tu [Servicio] [Fecha]\n\nPara confirmar responde SI antes de las [Hora límite].. Si no, liberaremos el horario.";
const STORED_CANCELLATION =
  "Tu cita de [Servicio] el [Fecha] a las [Hora límite]. en [Nombre del negocio] fue cancelada por falta de confirmación.";

const values = { servicio: "Consulta", fecha: "miércoles, 4 de noviembre", hora: "09:00 a.m.", negocio: "Clinica" };

test("usableTemplate keeps a valid stored text", () => {
  const text = "Cita en [Nombre del negocio]: [Servicio] el [Fecha] a las [Hora].";
  assert.equal(usableTemplate(text, "reminder", "default"), text);
});

test("usableTemplate falls back when the stored text is null or empty", () => {
  assert.equal(usableTemplate(null, "reminder", "default"), "default");
  assert.equal(usableTemplate("   ", "reminder", "default"), "default");
});

test("usableTemplate falls back for a reminder with the deadline tag", () => {
  assert.equal(usableTemplate(STORED_REMINDER, "reminder", "default"), "default");
});

test("usableTemplate falls back for a confirmation with an unknown tag", () => {
  assert.equal(usableTemplate(STORED_CONFIRMATION, "confirmation", "default"), "default");
});

test("usableTemplate falls back for a cancellation with the deadline tag", () => {
  assert.equal(usableTemplate(STORED_CANCELLATION, "cancellation", "default"), "default");
});

test("usableTemplate falls back for a confirmation that never asks to reply SI", () => {
  assert.equal(usableTemplate("Te esperamos antes de las [Hora límite].", "confirmation", "default"), "default");
});

test("cancellationText never carries a bracket when the stored text is invalid", () => {
  const text = cancellationText(STORED_CANCELLATION, values, "es");
  assert.equal(text.includes("["), false, text);
  assert.match(text, /Consulta/);
});

test("cancellationText uses a valid stored text", () => {
  const text = cancellationText("Cancelada: [Servicio] a las [Hora].", values, "es");
  assert.equal(text, "Cancelada: Consulta a las 09:00 a.m.");
});

function visit(templates: Partial<ReminderVisit["tenant"]>): ReminderVisit {
  return {
    id: "a1",
    tenantId: "t1",
    customerPhone: "525500000001",
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
      ...templates,
    },
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
  assert.equal(texts.length, 1);
  return texts[0];
}

test("a reminder built from the three stored production texts has no bracket and no duplicated confirmation", async () => {
  const text = await sentText(
    visit({ reminderTemplate: STORED_REMINDER, confirmationTemplate: STORED_CONFIRMATION, cancellationTemplate: STORED_CANCELLATION }),
  );
  assert.equal(text.includes("["), false, text);
  assert.equal(text.split(customerTexts("es").confirmationTemplate.slice(0, 20)).length - 1, 1, "confirmation sentence appears once");
});

test("an invalid stored reminder alone still falls back, with the valid confirmation kept", async () => {
  const confirmation = "Responde SI antes de las [Hora límite] para confirmar.";
  const text = await sentText(visit({ reminderTemplate: STORED_REMINDER, confirmationTemplate: confirmation }));
  assert.equal(text.includes("["), false, text);
  assert.match(text, /Responde SI antes de las \d/);
});

const REMINDER_ASKING_SI = "Recordatorio de tu cita de [Servicio] el [Fecha]. Responde SI para confirmarla.";

test("a reminder that already asks to reply SI is flagged, since the confirmation text is appended to it", () => {
  assert.equal(validateReminderNoConfirmation(REMINDER_ASKING_SI), "template_repeats_confirmation");
  assert.equal(validateReminderNoConfirmation("Recordatorio de tu cita de [Servicio] el [Fecha]."), null);
});

test("usableTemplate falls back for a reminder that asks to reply SI", () => {
  assert.equal(usableTemplate(REMINDER_ASKING_SI, "reminder", "default"), "default");
});

test("the sent message asks to confirm only once when the stored reminder already asks for SI", async () => {
  const text = await sentText(visit({ reminderTemplate: REMINDER_ASKING_SI }));
  assert.equal((text.match(/\bSI\b/g) ?? []).length, 1, text);
});
