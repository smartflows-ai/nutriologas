// Ticket #16: customer-written message texts (tags in square brackets) and their validation.
// Run: npx tsx --test local-utils/reminder-messages.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TEMPLATE_LENGTH,
  customerTexts,
  renderTemplate,
  validateConfirmationTemplate,
  validateKnownTags,
  validateNoDeadlineTag,
  validateTemplateLength,
} from "../src/lib/reminder-messages";
import { runReminderBatch, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-02T18:00:00.000Z");
const VALUES = { servicio: "Colposcopía", fecha: "martes, 3 de noviembre", hora: "10:00 a.m.", hora_limite: "09:30 a.m.", negocio: "Clinica Ejemplo" };

function visit(tenant: Partial<ReminderVisit["tenant"]> = {}): ReminderVisit {
  return {
    id: "a1",
    tenantId: "t1",
    customerPhone: "525500000002",
    customerName: null,
    appointmentDate: new Date(NOW.getTime() + 23 * HOUR),
    createdAt: new Date(NOW.getTime() - 48 * HOUR),
    reminderSentAt: null,
    reminderAttempts: 0,
    customerConfirmedAt: null,
    autoReleasedAt: null,
    externalProvider: null,
    externalEventId: null,
    productName: "Colposcopía",
    tenant: {
      name: "Clinica Ejemplo",
      messageLanguage: "es",
      reminderLeadMinutes: 24 * 60,
      confirmationRequired: true,
      confirmationDeadlineMinutes: 120,
      reminderTemplate: null,
      confirmationTemplate: null,
      cancellationTemplate: null,
      ...tenant,
    },
  };
}

async function sentText(v: ReminderVisit): Promise<string> {
  let text = "";
  const deps: ReminderDeps = {
    send: async (_visit, body) => {
      text = body;
      return { success: true };
    },
    markSent: async () => undefined,
    recordFailure: async () => undefined,
    charge: async () => undefined,
    release: async () => ({ customerNotified: true }),
  };
  await runReminderBatch([v], NOW, deps, { dryRun: false });
  return text;
}

test("every tag is replaced and no square brackets remain", () => {
  const text = renderTemplate("[Servicio] [Fecha] [Hora] [Hora límite] [Nombre del negocio]", VALUES);
  assert.equal(text, "Colposcopía martes, 3 de noviembre 10:00 a.m. 09:30 a.m. Clinica Ejemplo");
  assert.doesNotMatch(text, /[\[\]]/);
});

test("tags are case-insensitive, tolerate spaces, and accept English labels", () => {
  assert.equal(renderTemplate("[servicio] [ FECHA ] [Service] [Deadline time]", VALUES), "Colposcopía martes, 3 de noviembre Colposcopía 09:30 a.m.");
});

test("an unknown tag is left exactly as the owner typed it", () => {
  assert.equal(renderTemplate("Hola [Telefono]", VALUES), "Hola [Telefono]");
});

test("the deadline tag stays visible when the message has no deadline to give", () => {
  const { hora_limite: _unused, ...withoutDeadline } = VALUES;
  assert.equal(renderTemplate("antes de [Hora límite]", withoutDeadline), "antes de [Hora límite]");
});

test("a custom reminder and confirmation text reach the customer with tags filled in", async () => {
  const text = await sentText(
    visit({
      reminderTemplate: "Hola, te esperamos en [Nombre del negocio] para [Servicio] el [Fecha] a las [Hora].",
      confirmationTemplate: "Responde SI antes de las [Hora límite] o liberamos el horario.",
    }),
  );
  assert.match(text, /^Hola, te esperamos en Clinica Ejemplo para Colposcopía el .+ a las .+\./);
  assert.match(text, /Responde SI antes de las .+ o liberamos el horario\.$/);
  assert.doesNotMatch(text, /[\[\]]/);
});

test("an empty or missing text falls back to the default of the business language", async () => {
  const es = await sentText(visit({ reminderTemplate: null, confirmationTemplate: null }));
  assert.match(es, /Recordatorio de tu cita en/);
  const en = await sentText(visit({ messageLanguage: "en" }));
  assert.match(en, /Reminder of your appointment at/);
  assert.doesNotMatch(en, /Recordatorio de tu cita/);
});

test("a confirmation text needs the deadline tag", () => {
  assert.equal(validateConfirmationTemplate("Responde SI para confirmar."), "confirmation_missing_deadline");
});

test("a confirmation text needs the word SI", () => {
  assert.equal(validateConfirmationTemplate("Confirma antes de las [Hora límite]."), "confirmation_missing_si");
});

test("a confirmation text with deadline and SI is accepted, in Spanish or English labels", () => {
  assert.equal(validateConfirmationTemplate("Responde SI antes de las [Hora límite]."), null);
  assert.equal(validateConfirmationTemplate("Reply SI before [Deadline time]."), null);
});

// The bot already reads an accented reply ("Sí") as a yes (src/lib/confirmation-words.ts), so the text rule agrees with it.
test("SI with an accent, in any case, counts as the word SI", () => {
  for (const word of ["Sí", "SÍ", "sí", "si"]) {
    assert.equal(validateConfirmationTemplate(`Responde ${word} antes de las [Hora límite].`), null, word);
  }
});

test("words that merely contain the letters si do not count as the word SI", () => {
  assert.equal(validateConfirmationTemplate("Confirma así antes de las [Hora límite]."), "confirmation_missing_si");
  assert.equal(validateConfirmationTemplate("Confirma, por favor, antes de las [Hora límite]."), "confirmation_missing_si");
});

test("a text over the limit is rejected, one at the limit is accepted", () => {
  assert.equal(validateTemplateLength("x".repeat(MAX_TEMPLATE_LENGTH + 1)), "template_too_long");
  assert.equal(validateTemplateLength("x".repeat(MAX_TEMPLATE_LENGTH)), null);
});

// The deadline value only exists for the confirmation text (a reminder can go out with no deadline at all), so the
// other texts are rejected at save time instead of reaching the customer with brackets.
test("the reminder and cancellation texts cannot use the deadline tag, in Spanish or English", () => {
  assert.equal(validateNoDeadlineTag("Confirma antes de [Hora límite]."), "template_deadline_not_allowed");
  assert.equal(validateNoDeadlineTag("Confirm before [deadline time]."), "template_deadline_not_allowed");
  assert.equal(validateNoDeadlineTag("Confirma antes de [ HORA LÍMITE ]."), "template_deadline_not_allowed");
});

test("texts with any other tag, or none, are accepted by the deadline rule", () => {
  assert.equal(validateNoDeadlineTag("Tu cita es el [Fecha] a las [Hora] en [Nombre del negocio]."), null);
  assert.equal(validateNoDeadlineTag("Sin etiquetas."), null);
});

test("the confirmation text still accepts the deadline tag", () => {
  assert.equal(validateConfirmationTemplate("Responde SI antes de las [Hora límite]."), null);
});

// Any bracketed word that is not one of the five tags would reach the customer exactly as typed, so it is rejected on save.
test("a bracketed word that is not a known tag is rejected, whatever the language of the text", () => {
  assert.equal(validateKnownTags("Hola [Telefono]"), "template_unknown_tag");
  assert.equal(validateKnownTags("Cita el [Fecha] [ver mapa]"), "template_unknown_tag");
  assert.equal(validateKnownTags("Hello [Customer]"), "template_unknown_tag");
});

test("every known tag, in Spanish or English and any case, passes the known-tag rule", () => {
  assert.equal(validateKnownTags("[Servicio] [fecha] [HORA] [Hora límite] [Nombre del negocio]"), null);
  assert.equal(validateKnownTags("[Service] [Date] [Time] [Deadline time] [Business name]"), null);
});

test("text without brackets, or with brackets that do not form a tag, passes the known-tag rule", () => {
  assert.equal(validateKnownTags("Sin etiquetas."), null);
  assert.equal(validateKnownTags("Un corchete suelto [ sin cerrar"), null);
  assert.equal(validateKnownTags("Un corchete suelto ] sin abrir"), null);
  assert.equal(validateKnownTags("Corchetes vacios [] aqui"), null);
});

// The word SI must be an instruction to reply ("Responde SI", or SI in capitals), not the conditional "si" of Spanish.
test("a text that only has the conditional si never tells the customer to reply", () => {
  assert.equal(validateConfirmationTemplate("Si no vienes antes de las [Hora límite], se cancela."), "confirmation_missing_si");
  assert.equal(validateConfirmationTemplate("Si no la confirmas antes de las [Hora límite], se cancelará."), "confirmation_missing_si");
  assert.equal(validateConfirmationTemplate("Even if you do not come, see you at [Deadline time]."), "confirmation_missing_si");
});

test("an explicit instruction to reply is accepted in several wordings and both languages", () => {
  for (const text of [
    "Responde SI antes de las [Hora límite].",
    "Responde *SI* antes de las [Hora límite].",
    "Responde si antes de las [Hora límite].",
    "Escribe sí antes de las [Hora límite].",
    "Contesta SÍ antes de las [Hora límite].",
    "Reply SI before [Deadline time].",
    "Antes de las [Hora límite] manda SI para confirmar.",
  ]) {
    assert.equal(validateConfirmationTemplate(text), null, text);
  }
});

test("the default confirmation texts of both languages pass the rule", () => {
  assert.equal(validateConfirmationTemplate(customerTexts("es").confirmationTemplate), null);
  assert.equal(validateConfirmationTemplate(customerTexts("en").confirmationTemplate), null);
});

// "p.m." and "a.m." already end with a period, so a sentence that ends right after the tag must not get a second one.
test("a value that ends with a period does not double it when the template adds one right after the tag", () => {
  assert.equal(renderTemplate("a las [Hora].", VALUES), "a las 10:00 a.m.");
  assert.equal(renderTemplate("antes de las [Hora límite]. Si no", VALUES), "antes de las 09:30 a.m. Si no");
});

test("a value without a final period keeps the period the template adds", () => {
  assert.equal(renderTemplate("el [Fecha].", VALUES), "el martes, 3 de noviembre.");
});

test("a value that ends with a period keeps it when anything else follows the tag", () => {
  assert.equal(renderTemplate("a las [Hora], gracias", VALUES), "a las 10:00 a.m., gracias");
  assert.equal(renderTemplate("a las [Hora] y [Servicio]", VALUES), "a las 10:00 a.m. y Colposcopía");
  assert.equal(renderTemplate("a las [Hora]", VALUES), "a las 10:00 a.m.");
});

test("a sentence ending right after the time tag reaches the customer with a single period", async () => {
  const text = await sentText(
    visit({
      reminderTemplate: "Te esperamos el [Fecha] a las [Hora].",
      confirmationTemplate: "Responde SI antes de las [Hora límite]. Gracias.",
    }),
  );
  assert.doesNotMatch(text, /\.\./);
});

// The save rule and the renderer must agree: a tag the renderer fills in must also satisfy the validator.
test("a deadline tag with spaces or capitals inside the brackets satisfies the confirmation rule, as it renders", () => {
  for (const tag of ["[ Hora límite ]", "[HORA LÍMITE]", "[hora límite]", "[ Deadline time ]"]) {
    assert.equal(validateConfirmationTemplate(`Responde SI antes de las ${tag}.`), null, tag);
  }
});

test("a confirmation text with a different tag in place of the deadline is still rejected", () => {
  assert.equal(validateConfirmationTemplate("Responde SI antes de las [Hora]."), "confirmation_missing_deadline");
});
