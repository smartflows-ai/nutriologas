// tests/patient-intake.test.ts
// Rules for the first booking of a patient (name, age, optional email) and for the visit modality
// (in person or online). Pure functions, no database.
// Run with: npx tsx --test tests/patient-intake.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  contextPatientView,
  guestEmailFor,
  intakeNeeds,
  isOtherPersonsName,
  isSyntheticEmail,
  isValidAge,
  maskPhone,
  mergePatient,
  missingIntake,
  modalityModeOf,
  parseAge,
  referralOf,
  resolveBookingPhone,
  resolveModality,
  visitsOfSender,
} from "../src/lib/patient-intake";

test("a business that sees patients one way never asks the modality", () => {
  assert.equal(modalityModeOf("IN_PERSON"), "IN_PERSON");
  assert.equal(modalityModeOf("ONLINE"), "ONLINE");
  assert.equal(modalityModeOf("BOTH"), "ASK");
});

test("single-mode businesses resolve the modality by themselves, whatever was requested", () => {
  assert.deepEqual(resolveModality("IN_PERSON", undefined), { ok: true, modality: "IN_PERSON" });
  assert.deepEqual(resolveModality("IN_PERSON", "ONLINE"), { ok: true, modality: "IN_PERSON" });
  assert.deepEqual(resolveModality("ONLINE", undefined), { ok: true, modality: "ONLINE" });
});

test("a business that offers both needs the patient's choice", () => {
  assert.deepEqual(resolveModality("BOTH", "ONLINE"), { ok: true, modality: "ONLINE" });
  assert.deepEqual(resolveModality("BOTH", "IN_PERSON"), { ok: true, modality: "IN_PERSON" });
  assert.deepEqual(resolveModality("BOTH", undefined), { ok: false, error: "modality_required" });
  assert.deepEqual(resolveModality("BOTH", "presencial"), { ok: false, error: "modality_required" });
});

test("ages are whole numbers from 0 to 120, typed as a number or as text", () => {
  assert.equal(isValidAge(34), true);
  assert.equal(isValidAge(0), true);
  assert.equal(isValidAge(120), true);
  assert.equal(isValidAge(121), false);
  assert.equal(isValidAge(-1), false);
  assert.equal(isValidAge(34.5), false);
  assert.equal(parseAge("34"), 34);
  assert.equal(parseAge(" 34 "), 34);
  assert.equal(parseAge("34 años"), null);
  assert.equal(parseAge(""), null);
  assert.equal(parseAge(null), null);
  assert.equal(parseAge(200), null);
});

test("a known patient with a full name is never asked anything", () => {
  const known = { name: "Ana Lopez", email: null, age: null };
  assert.deepEqual(intakeNeeds(known), { askName: false, askAge: false, askEmail: false });
  assert.deepEqual(missingIntake(known, {}), []);
});

// Ticket #128: a registered name without a surname is asked again before booking, so bot/book never has to
// answer full_name_required after the patient already confirmed their data.
test("a known patient whose stored name has no surname is asked for the name", () => {
  for (const name of ["Ana", "Paciente", "", null, "  ", "asdf"]) {
    assert.deepEqual(intakeNeeds({ name, email: null, age: 30 }), { askName: true, askAge: false, askEmail: false }, String(name));
  }
});

test("a stored full name with a title or particles is not asked again", () => {
  for (const name of ["Dra. Ana López", "María de la Luz", "José Ángel Núñez"]) {
    assert.equal(intakeNeeds({ name, email: null, age: 30 }).askName, false, name);
  }
});

test("bot/context shows a stored name only when it is a full name", () => {
  assert.deepEqual(contextPatientView(null), { known: false });
  assert.deepEqual(contextPatientView({ name: "Ana Lopez", email: "ana@example.com", age: 30 }), {
    known: true,
    name: "Ana Lopez",
    age: 30,
    email: "ana@example.com",
  });
  assert.deepEqual(contextPatientView({ name: "Ana", email: null, age: 30 }), { known: true, name: null, age: 30, email: null });
  assert.deepEqual(contextPatientView({ name: "Paciente", email: null, age: null }), { known: true, name: null, age: null, email: null });
});

test("a new patient is asked for name and age, and offered the optional email", () => {
  assert.deepEqual(intakeNeeds(null), { askName: true, askAge: true, askEmail: true });
  assert.deepEqual(missingIntake(null, {}), ["name", "age"]);
  assert.deepEqual(missingIntake(null, { name: "Ana Lopez" }), ["age"]);
  assert.deepEqual(missingIntake(null, { name: "Ana Lopez", age: 31 }), []);
  assert.deepEqual(missingIntake(null, { name: "  ", age: 31 }), ["name"]);
  assert.deepEqual(missingIntake(null, { name: "Ana Lopez", age: 400 }), ["age"]);
});

test("an optional email never blocks a new patient", () => {
  assert.deepEqual(missingIntake(null, { name: "Ana Lopez", age: 31, email: "" }), []);
});

test("the stored record fills what the agent left out, and what the agent sends wins", () => {
  const known = { name: "Ana Lopez", email: "ana@example.com", age: 31 };
  assert.deepEqual(mergePatient(known, {}), { name: "Ana Lopez", email: "ana@example.com", age: 31 });
  assert.deepEqual(mergePatient(known, { email: "nueva@example.com", age: 32 }), {
    name: "Ana Lopez",
    email: "nueva@example.com",
    age: 32,
  });
  assert.deepEqual(mergePatient(null, { name: " Ana  Lopez ", age: "31" }), {
    name: "Ana Lopez",
    email: null,
    age: 31,
  });
});

test("a patient without email gets a stable guest address, recognised as not real", () => {
  assert.equal(guestEmailFor("528446683688"), "528446683688@wa.guest.local");
  assert.equal(isSyntheticEmail("528446683688@wa.guest.local"), true);
  assert.equal(isSyntheticEmail("anon_1730000000@booking.local"), true);
  assert.equal(isSyntheticEmail("ana@example.com"), false);
  assert.equal(isSyntheticEmail(null), false);
});

test("without another phone the visit is for the person writing", () => {
  const sender = "5218446683688";
  for (const none of [undefined, null, "", "   "]) {
    assert.deepEqual(resolveBookingPhone(sender, none), { ok: true, phone: sender, forOther: false });
  }
});

test("the sender's own number in another format is still the same person", () => {
  assert.deepEqual(resolveBookingPhone("5218446683688", "844 668 3688"), { ok: true, phone: "5218446683688", forOther: false });
  assert.deepEqual(resolveBookingPhone("5218446683688", "+52 844 668 3688"), { ok: true, phone: "5218446683688", forOther: false });
});

test("another valid number means the visit is for someone else, saved under their own number", () => {
  assert.deepEqual(resolveBookingPhone("5218446683688", "+52 81 1181 3540"), { ok: true, phone: "528111813540", forOther: true });
  assert.deepEqual(resolveBookingPhone("5218446683688", "8111813540"), { ok: true, phone: "528111813540", forOther: true });
});

test("a phone that is not a phone is refused", () => {
  assert.deepEqual(resolveBookingPhone("5218446683688", "123"), { ok: false, error: "invalid_patient_phone" });
  assert.deepEqual(resolveBookingPhone("5218446683688", "mi mama"), { ok: false, error: "invalid_patient_phone" });
});

// Ticket #148: the business's own numbers (Tenant.whatsappNumber and the connected line) are never a patient.
const SENDER = "5218446683688";
const BUSINESS_PHONES = ["+52 81 1181 3540", "521 844 123 4567"];

test("a number of the business is refused as the patient's phone, with or without the country code or the 1", () => {
  for (const typed of ["8111813540", "+52 81 1181 3540", "528111813540", "5218111813540"]) {
    assert.deepEqual(resolveBookingPhone(SENDER, typed, BUSINESS_PHONES), { ok: false, error: "business_phone" }, typed);
  }
});

test("the connected line of the business is refused too, not only the profile number", () => {
  for (const typed of ["8441234567", "528441234567", "5218441234567"]) {
    assert.deepEqual(resolveBookingPhone(SENDER, typed, BUSINESS_PHONES), { ok: false, error: "business_phone" }, typed);
  }
});

test("any other number still means a visit for someone else", () => {
  assert.deepEqual(resolveBookingPhone(SENDER, "8112223344", BUSINESS_PHONES), { ok: true, phone: "528112223344", forOther: true });
});

test("no business numbers, or empty or missing ones, refuse nothing", () => {
  assert.deepEqual(resolveBookingPhone(SENDER, "8111813540"), { ok: true, phone: "528111813540", forOther: true });
  assert.deepEqual(resolveBookingPhone(SENDER, "8111813540", []), { ok: true, phone: "528111813540", forOther: true });
  assert.deepEqual(resolveBookingPhone(SENDER, "8111813540", [null, undefined, ""]), { ok: true, phone: "528111813540", forOther: true });
});

test("the sender writing from a business number is still the sender, not a refusal", () => {
  assert.deepEqual(resolveBookingPhone(SENDER, "844 668 3688", ["8446683688"]), { ok: true, phone: SENDER, forOther: false });
});

test("a number that is not a phone keeps its own error before the business check", () => {
  assert.deepEqual(resolveBookingPhone(SENDER, "123", BUSINESS_PHONES), { ok: false, error: "invalid_patient_phone" });
});

test("a visit booked for someone else is an automatic recommendation by the person writing", () => {
  assert.deepEqual(referralOf(true, "5218446683688", "Ana Lopez"), { referredByKey: "528446683688", referredByName: "Ana Lopez" });
  assert.deepEqual(referralOf(true, "5218446683688", null), { referredByKey: "528446683688", referredByName: null });
});

test("a visit for the person writing has no recommendation", () => {
  assert.deepEqual(referralOf(false, "5218446683688", "Ana Lopez"), { referredByKey: null, referredByName: null });
});

test("the sender sees their own visits (also those saved under the normalized key) and the ones they booked for others", () => {
  assert.deepEqual(visitsOfSender("5218446683688"), {
    OR: [{ customerPhone: "5218446683688" }, { patientKey: "528446683688" }, { referredByKey: "528446683688" }],
  });
});

test("a sender without a usable phone key still matches the phone as typed", () => {
  assert.deepEqual(visitsOfSender("123"), { OR: [{ customerPhone: "123" }] });
});

// Ticket #72: the agent can drop patientPhone after a long exchange, and the visit for someone else was then saved
// under the sender's number. A different first name for a known sender, without another number, is caught here.
const knownSender = { name: "Ana Lopez Ruiz", email: null, age: 33 };

test("a known sender booking under another person's first name is a visit for someone else", () => {
  assert.equal(isOtherPersonsName(knownSender, "Carlos Antonio Mendez"), true);
});

test("a known sender correcting their own surname or a typo is still the same person", () => {
  assert.equal(isOtherPersonsName(knownSender, "Ana lpz"), false);
  assert.equal(isOtherPersonsName(knownSender, "Ana Lopez"), false);
  assert.equal(isOtherPersonsName(knownSender, "  ana   lopez  ruiz "), false);
});

test("a stored filler name is not compared: the patient can give their real name (ticket #113)", () => {
  // Otherwise bot/book asks for the full name and then refuses it as another person, and the agent loops.
  for (const stored of ["Paciente", "Desconocido", "Paciente / Cliente"]) {
    assert.equal(isOtherPersonsName({ name: stored, email: null, age: 30 }, "Ana López"), false, stored);
  }
  // A real one-word name is still compared: another first name is still another person (#72).
  assert.equal(isOtherPersonsName({ name: "Juan", email: null, age: 30 }, "María López"), true);
  assert.equal(isOtherPersonsName({ name: "Juan", email: null, age: 30 }, "Juan Pérez"), false);
});

test("case and accents do not make a different first name", () => {
  assert.equal(isOtherPersonsName({ name: "Maria Lopez", email: null, age: 40 }, "maría lópez"), false);
  assert.equal(isOtherPersonsName({ name: "José Ruiz", email: null, age: 40 }, "JOSE"), false);
});

test("a courtesy title before the name is not the first name", () => {
  assert.equal(isOtherPersonsName({ name: "Dra. Ana Lopez", email: null, age: 33 }, "Ana Lopez"), false);
  assert.equal(isOtherPersonsName(knownSender, "Sra. Ana Lopez"), false);
  assert.equal(isOtherPersonsName(knownSender, "ing ana"), false);
  assert.equal(isOtherPersonsName(knownSender, "Lic. Carlos Mendez"), true);
});

test("no name sent means the registered name is used, so it is never another person", () => {
  for (const none of [undefined, null, "", "   "]) {
    assert.equal(isOtherPersonsName(knownSender, none), false);
  }
});

test("an unknown sender, or one with no registered name, cannot be compared", () => {
  assert.equal(isOtherPersonsName(null, "Carlos Mendez"), false);
  assert.equal(isOtherPersonsName({ name: null, email: null, age: null }, "Carlos Mendez"), false);
  assert.equal(isOtherPersonsName({ name: "   ", email: null, age: null }, "Carlos Mendez"), false);
});

test("a nickname of the registered first name also asks who the visit is for (decision: option b)", () => {
  assert.equal(isOtherPersonsName({ name: "Patricia Lopez", email: null, age: 33 }, "Paty Lopez"), true);
});

test("the number the reminder goes to is shown with only its last four digits", () => {
  assert.equal(maskPhone("5218110000084"), "…0084");
  assert.equal(maskPhone("+52 81 1000 0084"), "…0084");
});

test("no usable number gives no masked number", () => {
  for (const none of [null, undefined, "", "   ", "12"]) {
    assert.equal(maskPhone(none), null);
  }
});
