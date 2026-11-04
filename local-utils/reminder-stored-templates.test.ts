// Ticket #16 defect: texts saved before the save-time checks existed (or by any other path) must never reach a
// customer with raw tags in brackets. At send time an invalid stored text falls back to the language default.
// Run: npx tsx --test local-utils/reminder-stored-templates.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cancellationText, customerTexts, usableTemplate, validateReminderNoConfirmation } from "../src/lib/reminder-messages";
import { runReminderBatch, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-02T18:00:00.000Z");

// The three texts found in production (business name generic; the confirmation had a tag that did not exist then, here [Telefono] stands for any unknown tag).
const STORED_REMINDER =
  "Recordatorio de tu cita en [Nombre del negocio].\n\nServicio: [Servicio]\nFecha: [Fecha]\nHora: [Hora]\n\n¿Confirmas tu cita? Responde SI para confirmarla. Si no la confirmas antes de las [Hora límite]., se cancelará y el horario quedará libre.";
const STORED_CONFIRMATION =
  "Hola [Telefono], te esperamos en [Nombre del negocio] para tu [Servicio] [Fecha]\n\nPara confirmar responde SI antes de las [Hora límite].. Si no, liberaremos el horario.";
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

// [Nombre] is the customer's name. It is valid in every text, and with no name it disappears without leaving gaps.
import { renderTemplate, templateProblem, validateKnownTags } from "../src/lib/reminder-messages";

test("[Nombre] is a known tag in every kind of text", () => {
  assert.equal(validateKnownTags("Hola [Nombre], tu cita es el [Fecha]."), null);
  assert.equal(templateProblem("Hola [Nombre], tu cita de [Servicio].", "reminder"), null);
  assert.equal(templateProblem("Hola [Nombre], tu cita de [Servicio] fue cancelada.", "cancellation"), null);
});

test("[Nombre] is filled with the customer's first name", () => {
  assert.equal(renderTemplate("Hola [Nombre], te esperamos.", { ...values, nombre: "Maria Fernanda Lopez" }), "Hola Maria, te esperamos.");
});

test("[Nombre] with no name leaves no hole before punctuation", () => {
  assert.equal(renderTemplate("Hola [Nombre], te esperamos.", { ...values, nombre: null }), "Hola, te esperamos.");
  assert.equal(renderTemplate("Hola [Nombre], te esperamos.", { ...values, nombre: "   " }), "Hola, te esperamos.");
  assert.equal(renderTemplate("Hola [Nombre], te esperamos.", values), "Hola, te esperamos.");
});

test("[Nombre] with no name leaves no double space in the middle of a sentence", () => {
  assert.equal(renderTemplate("Tu cita, [Nombre] de [Servicio]", { ...values, nombre: null }), "Tu cita, de Consulta");
  assert.equal(renderTemplate("Estimado [Nombre] gracias", { ...values, nombre: null }), "Estimado gracias");
});

test("the English label of the name tag is accepted too", () => {
  assert.equal(validateKnownTags("Hi [Customer name], see you."), null);
});

test("a reminder with [Nombre] and no customer name goes out with no bracket", async () => {
  const v = visit({ reminderTemplate: "Hola [Nombre], recordatorio de [Servicio] el [Fecha] a las [Hora]." });
  const text = await sentText({ ...v, customerName: null });
  assert.equal(text.includes("["), false, text);
  assert.match(text, /^Hola, recordatorio/);
});

test("a reminder with [Nombre] uses the customer's first name when there is one", async () => {
  const v = visit({ reminderTemplate: "Hola [Nombre], recordatorio de [Servicio]." });
  const text = await sentText({ ...v, customerName: "Juan Perez" });
  assert.match(text, /^Hola Juan, recordatorio/);
});

// Live validation in the settings card: every problem comes with the fragments to highlight.
import { templateIssues } from "../src/lib/reminder-template-rules";

test("templateIssues is empty for a valid text of each kind", () => {
  assert.deepEqual(templateIssues("Cita de [Servicio] el [Fecha] a las [Hora].", "reminder"), []);
  assert.deepEqual(templateIssues("Responde SI antes de las [Hora límite].", "confirmation"), []);
  assert.deepEqual(templateIssues("Cancelada: [Servicio] a las [Hora].", "cancellation"), []);
});

test("templateIssues points at the deadline tag in a reminder", () => {
  const issues = templateIssues("Antes de las [Hora límite]., se cancela.", "reminder");
  assert.deepEqual(issues, [{ code: "template_deadline_not_allowed", fragments: ["[Hora límite]"] }]);
});

test("templateIssues points at every unknown tag", () => {
  const issues = templateIssues("Hola [Telefono] y [Edad], cita [Fecha].", "reminder");
  assert.deepEqual(issues, [{ code: "template_unknown_tag", fragments: ["[Telefono]", "[Edad]"] }]);
});

test("templateIssues points at the SI request inside a reminder", () => {
  const issues = templateIssues("Cita el [Fecha]. Responde SI para confirmarla.", "reminder");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "template_repeats_confirmation");
  assert.match(issues[0].fragments[0], /SI/);
});

test("templateIssues reports a confirmation that lacks the deadline and the SI request", () => {
  const codes = templateIssues("Te esperamos el [Fecha].", "confirmation").map((i) => i.code);
  assert.deepEqual(codes, ["confirmation_missing_deadline", "confirmation_missing_si"]);
});

test("templateIssues reports a text that is too long", () => {
  assert.equal(templateIssues("x".repeat(601), "cancellation")[0].code, "template_too_long");
});

test("templateProblem is the code of the first issue", () => {
  assert.equal(templateProblem("Hola [Telefono]", "reminder"), "template_unknown_tag");
  assert.equal(templateProblem("Cita de [Servicio]", "reminder"), null);
});

// One-click fixes next to each problem.
import { suggestFix } from "../src/lib/reminder-template-rules";

const PROD_REMINDER =
  "Recordatorio de tu cita en [Nombre del negocio].\n\nServicio: [Servicio]\nFecha: [Fecha]\nHora: [Hora]\n\n¿Confirmas tu cita? Responde SI para confirmarla. Si no la confirmas antes de las [Hora límite]., se cancelará y el horario quedará libre.";

test("a reminder with the confirmation paragraph is fixed by removing that paragraph, and is then valid", () => {
  const [issue] = templateIssues(PROD_REMINDER, "reminder");
  const fix = suggestFix(PROD_REMINDER, issue, "reminder", "Hora");
  assert.equal(fix?.action, "remove_paragraph");
  assert.equal(fix?.text, "Recordatorio de tu cita en [Nombre del negocio].\n\nServicio: [Servicio]\nFecha: [Fecha]\nHora: [Hora]");
  assert.deepEqual(templateIssues(fix!.text, "reminder"), []);
});

test("a cancellation with the deadline tag is fixed by replacing it with the time tag", () => {
  const text = "Tu cita de [Servicio] el [Fecha] a las [Hora límite]. en [Nombre del negocio] fue cancelada.";
  const issue = templateIssues(text, "cancellation")[0];
  const fix = suggestFix(text, issue, "cancellation", "Hora");
  assert.equal(fix?.action, "replace_time");
  assert.equal(fix?.text, "Tu cita de [Servicio] el [Fecha] a las [Hora]. en [Nombre del negocio] fue cancelada.");
  assert.deepEqual(templateIssues(fix!.text, "cancellation"), []);
});

test("a single-paragraph reminder only loses the offending fragment, never the whole text", () => {
  const text = "Cita de [Servicio] el [Fecha]. Responde SI para confirmarla.";
  const issue = templateIssues(text, "reminder")[0];
  const fix = suggestFix(text, issue, "reminder", "Hora");
  assert.equal(fix?.action, "remove_fragment");
  assert.notEqual(fix?.text.trim(), "");
  assert.match(fix!.text, /Cita de \[Servicio\]/);
});

test("an unknown tag is fixed by removing just that tag, without leaving a gap", () => {
  const text = "Hola [Telefono], tu cita es el [Fecha].";
  const issue = templateIssues(text, "reminder")[0];
  const fix = suggestFix(text, issue, "reminder", "Hora");
  assert.equal(fix?.action, "remove_fragment");
  assert.equal(fix?.text, "Hola, tu cita es el [Fecha].");
});

test("problems about the whole text have no one-click fix", () => {
  const issue = templateIssues("Te esperamos el [Fecha].", "confirmation")[0];
  assert.equal(suggestFix("Te esperamos el [Fecha].", issue, "confirmation", "Hora"), null);
});
