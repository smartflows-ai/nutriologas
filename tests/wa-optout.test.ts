// tests/wa-optout.test.ts
// Run: npx tsx --test tests/wa-optout.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isOptOut } from "../src/lib/wa-optout";

// For ban prevention a false negative (keep messaging after "stop") is the dangerous case, so detection is generous.
const optOuts = [
  "baja",
  "BAJA",
  "stop",
  "Stop.",
  "unsubscribe",
  "ya no me escribas",
  "ya no me escriban por favor",
  "no me escriban mas",
  "no me manden mas mensajes",
  "no quiero recibir mas mensajes",
  "dejen de escribirme",
  "deja de enviarme mensajes",
  "quiero darme de baja",
  "me quiero dar de baja de los mensajes",
  "eliminen mi numero",
  "borren mi numero",
  "no me contacten mas",
];

for (const text of optOuts) {
  test(`opt-out: "${text}"`, () => {
    assert.equal(isOptOut(text), true);
  });
}

// Must NOT trigger: these are normal chats or appointment actions the bot handles.
const notOptOuts = [
  "cancelar mi cita",
  "quiero cancelar la cita del martes",
  "puedo cancelar mi cita?",
  "no, mejor el martes",
  "no puedo ese dia",
  "no gracias",
  "hola, quiero una cita",
  "me das info?",
  "baja california", // place name, not "baja" alone
  "el bebe esta bajo de peso", // "bajo" substring
  "paro para descansar", // "paro"/"stop" substring safety
  "¿cuánto cuesta?",
  "",
  "   ",
];

for (const text of notOptOuts) {
  test(`not opt-out: "${text}"`, () => {
    assert.equal(isOptOut(text), false);
  });
}

test("accents and extra spaces do not change the result", () => {
  assert.equal(isOptOut("  YA NO ME ESCRÍBAS  "), true);
  assert.equal(isOptOut("dénme de baja"), true);
});

test("a long message that merely contains 'baja' is not an opt-out", () => {
  assert.equal(isOptOut("vivo en baja y quiero una cita el lunes"), false);
});
