// tests/template-double-period.test.ts
// Ticket #74: a business text with two periods after a tag ("antes de las [Hora límite].. Si no") read "a.m.." in
// production. The repeated period is shown as one when sending, and the settings card flags it on save with a
// one-click fix. The send-time check (usableTemplate) does NOT treat it as invalid: a business text with ".." keeps
// being sent (with one period) instead of falling back to the default.
// Run with: npx tsx --test tests/template-double-period.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { punctuationIssues, saveIssues, suggestFix, templateIssues } from "../src/lib/reminder-template-rules";
import { renderTemplate, usableTemplate } from "../src/lib/reminder-messages";

const CONFIRMATION = "Responde *SI* para confirmar. Si no la confirmas antes de las [Hora límite].. Si no, se libera.";
const VALUES = { servicio: "Consulta", fecha: "lunes, 23 de noviembre", hora: "02:30 p.m.", hora_limite: "11:30 a.m.", negocio: "Newy" };

test("two periods right after a tag are flagged, also behind bold or italic markers", () => {
  assert.deepEqual(punctuationIssues(CONFIRMATION), [{ code: "template_double_period", fragments: ["[Hora límite].."] }]);
  assert.deepEqual(punctuationIssues("Te esperamos a las *[Hora]*.."), [{ code: "template_double_period", fragments: ["[Hora]*.."] }]);
});

test("one period, an ellipsis, or two periods with no tag before them are not flagged", () => {
  assert.deepEqual(punctuationIssues("Te esperamos a las [Hora]."), []);
  assert.deepEqual(punctuationIssues("Te esperamos a las [Hora]... o antes"), []);
  assert.deepEqual(punctuationIssues("Gracias.. nos vemos"), []);
});

test("the save check includes it, the send-time check does not", () => {
  assert.ok(saveIssues(CONFIRMATION, "confirmation").some((issue) => issue.code === "template_double_period"));
  assert.ok(!templateIssues(CONFIRMATION, "confirmation").some((issue) => issue.code === "template_double_period"));
  assert.equal(usableTemplate(CONFIRMATION, "confirmation", "DEFAULT"), CONFIRMATION);
});

test("the one-click fix leaves a single period", () => {
  const [issue] = punctuationIssues(CONFIRMATION);
  assert.deepEqual(suggestFix(CONFIRMATION, issue, "confirmation", "Hora"), {
    action: "fix_punctuation",
    text: "Responde *SI* para confirmar. Si no la confirmas antes de las [Hora límite]. Si no, se libera.",
  });
});

test("a stored text with two periods after a tag is sent with one (no 'a.m..')", () => {
  const sent = renderTemplate(CONFIRMATION, VALUES);
  assert.ok(sent.includes("antes de las 11:30 a.m. Si no, se libera."), sent);
  assert.ok(!sent.includes(".."), sent);
  assert.equal(renderTemplate("A las *[Hora]*.. Gracias", VALUES), "A las *02:30 p.m.* Gracias");
});
