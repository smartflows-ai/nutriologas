// tests/cancel-notice.test.ts
// Ticket #161: a visit cancelled by the business (panel) or by the patient (Mis citas) was told "cancelada por falta de
// confirmación", the text of the automatic release. Which text goes out depends on who cancels. Pure rule, no database.
// Run with: npx tsx --test tests/cancel-notice.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cancelNoticeKind, cancelNoticeText, type CancelOrigin } from "../src/lib/cancel-notice";
import { templateIssues } from "../src/lib/reminder-template-rules";
import { es } from "../src/i18n/es";
import { en } from "../src/i18n/en";

const VALUES = { servicio: "Consulta", fecha: "martes, 24 de noviembre", hora: "4:00 p.m.", zona: "hora de Monterrey", negocio: "Negocio Ejemplo" };
const STORED_RELEASE = "Tu cita fue cancelada por falta de confirmación, escríbenos.";

test("who cancels decides the text: the business and the patient get the neutral text, only the automatic release gets the release text", () => {
  const expected: Record<CancelOrigin, string> = {
    panel: "neutral",
    patient: "neutral",
    auto_release: "release",
    confirmations_release: "release",
    bot: "none",
  };
  for (const [origin, kind] of Object.entries(expected)) assert.equal(cancelNoticeKind(origin as CancelOrigin), kind, origin);
});

test("a cancellation by the business never uses the stored release text, even when the business saved one", () => {
  const text = cancelNoticeText("panel", STORED_RELEASE, VALUES, "es");
  assert.ok(text);
  assert.doesNotMatch(text, /falta de confirmaci|no recibimos/i);
  assert.match(text, /Consulta/);
  assert.match(text, /24 de noviembre/);
  assert.match(text, /4:00 p\.m\./);
  assert.match(text, /hora de Monterrey/);
  assert.match(text, /Negocio Ejemplo/);
  assert.match(text, /fue cancelada/);
});

test("the patient who cancels in Mis citas gets the same neutral text, which never says who cancelled", () => {
  const patient = cancelNoticeText("patient", STORED_RELEASE, VALUES, "es");
  assert.equal(patient, cancelNoticeText("panel", STORED_RELEASE, VALUES, "es"));
  assert.doesNotMatch(patient ?? "", /el negocio cancel|cancelaste|cancelamos|falta de confirmaci/i);
});

test("the automatic release still uses the business's own text, or the default release text when it wrote none", () => {
  assert.equal(cancelNoticeText("auto_release", STORED_RELEASE, VALUES, "es"), STORED_RELEASE);
  assert.match(cancelNoticeText("auto_release", null, VALUES, "es") ?? "", /falta de confirmaci/);
  assert.match(cancelNoticeText("confirmations_release", "   ", VALUES, "es") ?? "", /falta de confirmaci/);
});

test("the bot cancels in the chat itself: the app sends no notice", () => {
  assert.equal(cancelNoticeText("bot", null, VALUES, "es"), null);
});

test("the neutral text exists in both languages, follows the business language and gives no reason", () => {
  const spanish = cancelNoticeText("panel", null, VALUES, "es") ?? "";
  const english = cancelNoticeText("panel", null, { ...VALUES, zona: "Monterrey time" }, "en") ?? "";
  assert.match(spanish, /cancelada/);
  assert.match(english, /cancelled/);
  assert.doesNotMatch(english, /confirmation|lack of/i);
  assert.notEqual(spanish, english);
});

test("the neutral text uses only tags a cancellation text accepts, and names no kind of business", () => {
  for (const texts of [es.customerMessages, en.customerMessages]) {
    assert.deepEqual(templateIssues(texts.cancelledNoticeTemplate, "cancellation"), []);
    assert.doesNotMatch(texts.cancelledNoticeTemplate, /consultorio|paciente|cl[ií]nica|doctor|patient|clinic/i);
    assert.doesNotMatch(texts.cancelledNoticeTemplate, /\[Ubicaci|\[Location|\[Hora l/i);
  }
});

test("the saved release text is not changed and the card says what it is for", () => {
  assert.match(es.crm.business.cancellationTemplateLabel, /falta de confirmaci/i);
  assert.match(en.crm.business.cancellationTemplateLabel, /confirmation/i);
});

test("wiring: the panel and patient notice use the neutral text, and only releaseVisit uses the stored cancellation text", () => {
  const actions = readFileSync("src/lib/reminder-actions.ts", "utf8");
  const panel = actions.slice(actions.indexOf("export async function notifyCancelledFromPanel"), actions.indexOf("export async function notifyMovedFromPanel"));
  assert.match(panel, /cancelNoticeText\("panel"/);
  assert.doesNotMatch(panel, /cancellationText\(/);
  const release = actions.slice(actions.indexOf("export async function releaseVisit"), actions.indexOf("export function ownerConfirmationText"));
  assert.match(release, /cancelNoticeText\("auto_release"/);
});
