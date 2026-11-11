// Priority rule for the customer messages of the reminder job:
//   a text the business wrote is the one that is sent; the default text is used only where the business wrote none.
// Regression: a business with its own reminder and confirmation texts was sent the reminder text above the
// confirmation text (greeting and visit details twice), and a default footer under its own reminder text.
// Run: npx tsx --test tests/custom-vs-default-messages.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runReminderBatch, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";
import { cancellationText, customerTexts } from "../src/lib/reminder-messages";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-11T12:06:00.000Z");

// Fragments that only the default texts contain.
const DEFAULT_REMINDER_ES = "Recordatorio de tu cita";
const DEFAULT_REQUEST_ES = "¿Confirmas tu cita?";
const DEFAULT_FOOTER_ES = "Si necesitas cambiarla o cancelarla";

const CUSTOM_REMINDER = "Hola *[Customer name]*, te esperamos en *[Business name]*.\n\n📋 *Servicio:* [Service]\n🕒 *Hora:* [Time]\n\nCuidamos tu salud.";
const CUSTOM_CONFIRMATION_FULL =
  "Hola *[Customer name]*.\n\nConfirma tu cita en *[Business name]*.\n\n📋 *Servicio:* [Service]\n🕒 *Hora:* [Time]\n\nResponde *SI* antes de las *[Deadline time]*.\n\nGracias.";
const CUSTOM_CONFIRMATION_SHORT = "Responde *SI* para confirmar. Después de las [Deadline time] se libera el horario.";

function visit(tenant: Partial<ReminderVisit["tenant"]> = {}, overrides: Partial<ReminderVisit> = {}): ReminderVisit {
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
      reminderTemplate: null,
      confirmationTemplate: null,
      cancellationTemplate: null,
      locationText: null,
      ...tenant,
    },
    ...overrides,
  };
}

async function sent(v: ReminderVisit): Promise<string> {
  const texts: string[] = [];
  const deps: ReminderDeps = {
    send: async (_v, text) => {
      texts.push(text);
      return { success: true };
    },
    markSent: async () => undefined,
    recordFailure: async () => undefined,
    charge: async () => undefined,
    release: async () => ({ customerNotified: true }),
  };
  await runReminderBatch([v], NOW, deps, { dryRun: false });
  assert.equal(texts.length, 1, "exactly one message per visit");
  return texts[0];
}

async function withCapturedWarnings<T>(run: () => Promise<T>): Promise<{ result: T; warnings: string[] }> {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  try {
    return { result: await run(), warnings };
  } finally {
    console.warn = original;
  }
}

test("no custom text at all: the default reminder and the default request are sent", async () => {
  const text = await sent(visit());
  assert.ok(text.includes(DEFAULT_REMINDER_ES));
  assert.ok(text.includes(DEFAULT_REQUEST_ES));
});

test("no custom text, English business: the English defaults are sent", async () => {
  const text = await sent(visit({ messageLanguage: "en" }));
  assert.ok(text.includes(customerTexts("en").reminderTemplate.slice(0, 18)));
  assert.ok(text.includes("Do you confirm your appointment?"));
});

test("custom reminder only: its text is sent and the default reminder is not", async () => {
  const text = await sent(visit({ reminderTemplate: CUSTOM_REMINDER }));
  assert.ok(text.includes("te esperamos en *Doctor G Center*"));
  assert.ok(!text.includes(DEFAULT_REMINDER_ES));
  assert.ok(text.includes(DEFAULT_REQUEST_ES), "no custom confirmation: the default request is what asks to reply");
});

test("custom confirmation that names the visit, no custom reminder: only the custom confirmation is sent", async () => {
  const text = await sent(visit({ confirmationTemplate: CUSTOM_CONFIRMATION_FULL }));
  assert.ok(text.includes("Confirma tu cita en *Doctor G Center*"));
  assert.ok(!text.includes(DEFAULT_REMINDER_ES), "the default reminder is not sent above a custom confirmation");
  assert.ok(!text.includes(DEFAULT_REQUEST_ES));
});

test("custom confirmation that is only the request, no custom reminder: default reminder + the custom request", async () => {
  const text = await sent(visit({ confirmationTemplate: CUSTOM_CONFIRMATION_SHORT }));
  assert.ok(text.includes(DEFAULT_REMINDER_ES), "the visit details still have to reach the customer");
  assert.ok(text.includes("se libera el horario"));
  assert.ok(!text.includes(DEFAULT_REQUEST_ES), "the default request is not added next to a custom one");
});

test("both custom: the custom confirmation is the whole message, nothing of the defaults appears", async () => {
  const text = await sent(visit({ reminderTemplate: CUSTOM_REMINDER, confirmationTemplate: CUSTOM_CONFIRMATION_FULL }));
  assert.ok(text.includes("Confirma tu cita en *Doctor G Center*"));
  assert.ok(!text.includes("te esperamos en"), "the reminder text is not repeated above the confirmation");
  for (const fragment of [DEFAULT_REMINDER_ES, DEFAULT_REQUEST_ES, DEFAULT_FOOTER_ES]) assert.ok(!text.includes(fragment));
  assert.equal(text.match(/Hola /g)?.length, 1);
  assert.equal(text.match(/Servicio/g)?.length, 1);
});

test("both custom, short confirmation: the custom reminder and the custom request, no defaults", async () => {
  const text = await sent(visit({ reminderTemplate: CUSTOM_REMINDER, confirmationTemplate: CUSTOM_CONFIRMATION_SHORT }));
  assert.ok(text.includes("te esperamos en *Doctor G Center*"));
  assert.ok(text.includes("se libera el horario"));
  for (const fragment of [DEFAULT_REMINDER_ES, DEFAULT_REQUEST_ES, DEFAULT_FOOTER_ES]) assert.ok(!text.includes(fragment));
});

test("custom reminder, visit already confirmed: it is sent as written, without the default footer", async () => {
  const text = await sent(visit({ reminderTemplate: CUSTOM_REMINDER }, { customerConfirmedAt: new Date(NOW.getTime() - HOUR) }));
  assert.ok(text.includes("te esperamos en *Doctor G Center*"));
  assert.ok(!text.includes(DEFAULT_FOOTER_ES));
  assert.ok(!text.includes(DEFAULT_REQUEST_ES));
});

test("custom reminder, confirmation turned off: it is sent as written, without the default footer", async () => {
  const text = await sent(visit({ reminderTemplate: CUSTOM_REMINDER, confirmationRequired: false }));
  assert.ok(text.includes("te esperamos en *Doctor G Center*"));
  assert.ok(!text.includes(DEFAULT_FOOTER_ES));
});

test("default reminder, confirmation turned off: the default footer is still added", async () => {
  const text = await sent(visit({ confirmationRequired: false }));
  assert.ok(text.includes(DEFAULT_REMINDER_ES));
  assert.ok(text.includes(DEFAULT_FOOTER_ES));
});

test("a text with only spaces counts as no custom text", async () => {
  const text = await sent(visit({ reminderTemplate: "   \n ", confirmationTemplate: "  " }));
  assert.ok(text.includes(DEFAULT_REMINDER_ES));
  assert.ok(text.includes(DEFAULT_REQUEST_ES));
});

test("a custom text is sent as written in the language of the business, not translated or replaced", async () => {
  const text = await sent(visit({ messageLanguage: "en", reminderTemplate: "Hola [Customer name], nos vemos hoy." }));
  assert.ok(text.includes("Hola Scarllet, nos vemos hoy."));
});

test("a saved text that cannot be filled in falls back to the default and the reason is logged, never sent raw", async () => {
  const { result: text, warnings } = await withCapturedWarnings(() =>
    sent(visit({ reminderTemplate: "Hola [Nombre], tu [Cosa inventada] está lista." })),
  );
  assert.ok(text.includes(DEFAULT_REMINDER_ES));
  assert.ok(!text.includes("[Cosa inventada]"));
  assert.ok(warnings.some((w) => w.includes("reminder text ignored")));
});

test("a valid custom text never triggers the fallback warning", async () => {
  const { warnings } = await withCapturedWarnings(() =>
    sent(visit({ reminderTemplate: CUSTOM_REMINDER, confirmationTemplate: CUSTOM_CONFIRMATION_FULL })),
  );
  assert.deepEqual(warnings, []);
});

test("the real saved texts of a business: one message, its own wording, no default text, one period after the time", async () => {
  const reminder =
    "Hola *[Customer name]* 👋💗\n\nTe recordamos que tienes una cita programada en *[Nombre del negocio]*.\n\n📋 *Servicio:* [Service]\n📅 *Fecha:* [Date]\n🕒 *Hora:* [Time]\n📍 *Ubicación:* [Location]\n\nSerá un gusto atenderte. ¡Te esperamos!\n\n*DoctorG Center*";
  const confirmation =
    "Hola *[Customer name]* 💗\n\nQueremos confirmar tu próxima cita en *[Business name]*.\n\n📋 *Servicio:* [Service]\n📅 *Fecha:* [Date]\n🕒 *Hora:* [Time]\n\n¿Nos confirmas tu asistencia?\n\nPor favor, responde *SI* para confirmar tu cita antes de las *[Deadline time]*.\n\nEn caso de no recibir confirmación dentro del plazo establecido, el horario será liberado.\n\n*DoctorG Center*";
  const text = await sent(
    visit({ reminderTemplate: reminder, confirmationTemplate: confirmation, locationText: "Edificio Vantash 702, Monterrey" }),
  );
  assert.ok(text.startsWith("Hola *Scarllet* 💗"));
  assert.ok(!text.includes("Te recordamos"));
  assert.ok(text.includes("Ubicación: Edificio Vantash 702, Monterrey"));
  assert.ok(!text.includes(".."), "no doubled period after a.m. or p.m.");
  assert.ok(!text.includes("["), "no tag is left unfilled");
});

test("an online visit with no link yet never shows an empty place label", async () => {
  const reminder = "Hola.\n📍 *Ubicación:* [Location]\nFin";
  const text = await sent(visit({ reminderTemplate: reminder, confirmationRequired: false }, { modality: "ONLINE", meetUrl: null }));
  assert.ok(!text.includes("Ubicación"));
});

// --- Cancellation text -------------------------------------------------------------------------------------------

const cancelValues = { servicio: "Colposcopía", fecha: "miércoles, 11 de noviembre", hora: "10:00 a.m.", negocio: "Doctor G Center", nombre: "Scarllet" };

test("cancellation: the custom text is sent, the default only when there is none", () => {
  const custom = cancellationText("Hola [Nombre], liberamos tu cita de [Servicio].", cancelValues, "es");
  assert.equal(custom, "Hola Scarllet, liberamos tu cita de Colposcopía.");
  const fallback = cancellationText(null, cancelValues, "es");
  assert.ok(fallback.includes("fue cancelada por falta de confirmación"));
  assert.equal(cancellationText("   ", cancelValues, "es"), fallback);
});

test("cancellation: a saved text that cannot be filled in falls back to the default, logged", () => {
  const problems: string[] = [];
  const text = cancellationText("Tu cita de [Servicio] en [Lugar raro] fue cancelada.", cancelValues, "es", (p) => problems.push(p));
  assert.ok(text.includes("fue cancelada por falta de confirmación"));
  assert.ok(!text.includes("[Lugar raro]"));
  assert.equal(problems.length, 1);
});

// --- Wiring: every place that sends one of these texts passes the business's saved text --------------------------

const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");

test("the job loads all three saved texts of the business", () => {
  const source = read("src/lib/reminder-data.ts");
  for (const field of ["reminderTemplate: true", "confirmationTemplate: true", "cancellationTemplate: true"]) assert.ok(source.includes(field), field);
});

test("every cancellation sent to a customer passes the saved cancellation text", () => {
  assert.ok(read("src/lib/reminder-actions.ts").includes("cancellationText(visit.cancellationTemplate"));
  const owner = read("src/app/api/apps/whatsapp/confirmations/[id]/route.ts");
  assert.ok(owner.includes("cancellationTemplate: true") && owner.includes("cancellationTemplate: visit.tenant.cancellationTemplate"));
});

// --- Default reminder + custom confirmation + default cancellation (the Doctor G Center setup) ------------------

const DOCTOR_G_CONFIRMATION =
  "Hola *[Customer name]* 💗\n\nQueremos confirmar tu próxima cita en *[Business name]*.\n\n📋 *Servicio:* [Service]\n📅 *Fecha:* [Date]\n🕒 *Hora:* [Time]\n📍 *Ubicación:* [Location]\n\n¿Nos confirmas tu asistencia?\n\nPor favor, responde *SI* para confirmar tu cita antes de las *[Deadline time]*.\n\nEn caso de no recibir confirmación dentro del plazo establecido, el horario será liberado.\n\n¡Gracias por tu preferencia!\n*DoctorG Center*";

const MIXED = { reminderTemplate: null, confirmationTemplate: DOCTOR_G_CONFIRMATION, cancellationTemplate: null };

test("default reminder + custom confirmation: the visit gets only the custom confirmation, in person with the address", async () => {
  const text = await sent(visit({ ...MIXED, locationText: "Edificio Vantash 702, Monterrey" }));
  assert.ok(text.startsWith("Hola *Scarllet* 💗"));
  assert.ok(text.includes("📍 *Ubicación:* Edificio Vantash 702, Monterrey"));
  assert.equal(text.match(/Ubicación/g)?.length, 1, "the address is not added a second time");
  for (const fragment of [DEFAULT_REMINDER_ES, DEFAULT_REQUEST_ES, DEFAULT_FOOTER_ES]) assert.ok(!text.includes(fragment));
  assert.ok(!text.includes("[") && !text.includes(".."));
});

test("default reminder + custom confirmation: an online visit shows its video call link on the location line", async () => {
  const text = await sent(visit({ ...MIXED }, { modality: "ONLINE", meetUrl: "https://meet.google.com/abc-defg-hij" }));
  assert.ok(text.includes("📍 *Ubicación:* https://meet.google.com/abc-defg-hij"));
  assert.ok(!text.includes("Videollamada:"), "the link is not added a second time");
});

test("default reminder + custom confirmation: an online visit with no link yet has no empty location line", async () => {
  const text = await sent(visit({ ...MIXED }, { modality: "ONLINE", meetUrl: null }));
  assert.ok(!text.includes("Ubicación"));
  assert.ok(text.includes("¿Nos confirmas tu asistencia?"));
});

test("default reminder + custom confirmation: a visit that needs no confirmation gets the default reminder and footer", async () => {
  const text = await sent(visit({ ...MIXED, locationText: "Edificio Vantash 702" }, { customerConfirmedAt: new Date(NOW.getTime() - HOUR) }));
  assert.ok(text.includes(DEFAULT_REMINDER_ES));
  assert.ok(text.includes(DEFAULT_FOOTER_ES));
  assert.ok(!text.includes("Queremos confirmar"), "the custom confirmation is not sent to a visit that is already confirmed");
  assert.ok(!text.includes("Responde *SI*") && !/\bSI\b/.test(text));
});

test("default reminder + custom confirmation: when the visit is released the default cancellation text is sent", () => {
  const text = cancellationText(MIXED.cancellationTemplate, cancelValues, "es");
  assert.equal(text, customerTexts("es").cancellationTemplate
    .replace("[Servicio]", cancelValues.servicio)
    .replace("[Fecha]", cancelValues.fecha)
    .replace("[Hora]", cancelValues.hora)
    .replace("[Nombre del negocio]", cancelValues.negocio));
  assert.ok(!text.includes("DoctorG Center"), "nothing of the custom confirmation leaks into the cancellation");
});

test("default reminder + custom confirmation: the release runs and nothing else is sent for that visit", async () => {
  const overdue = visit({ ...MIXED }, { reminderSentAt: new Date(NOW.getTime() - 2 * HOUR), appointmentDate: new Date(NOW.getTime() + 30 * 60 * 1000) });
  const released: string[] = [];
  const messages: string[] = [];
  const deps: ReminderDeps = {
    send: async (_v, text) => {
      messages.push(text);
      return { success: true };
    },
    markSent: async () => undefined,
    recordFailure: async () => undefined,
    charge: async () => undefined,
    release: async (v) => {
      released.push(v.id);
      return { customerNotified: true };
    },
  };
  const result = await runReminderBatch([overdue], NOW, deps, { dryRun: false });
  assert.equal(result.released, 1);
  assert.deepEqual(released, ["a1"]);
  assert.deepEqual(messages, [], "the release sends the cancellation through its own path, never a second reminder");
});
