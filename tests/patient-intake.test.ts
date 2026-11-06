// tests/patient-intake.test.ts
// Rules for the first booking of a patient (name, age, optional email) and for the visit modality
// (in person or online). Pure functions, no database.
// Run with: npx tsx --test tests/patient-intake.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  guestEmailFor,
  intakeNeeds,
  isSyntheticEmail,
  isValidAge,
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

test("a known patient is never asked anything", () => {
  const known = { name: "Ana Lopez", email: null, age: null };
  assert.deepEqual(intakeNeeds(known), { askName: false, askAge: false, askEmail: false });
  assert.deepEqual(missingIntake(known, {}), []);
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

test("a visit booked for someone else is an automatic recommendation by the person writing", () => {
  assert.deepEqual(referralOf(true, "5218446683688", "Ana Lopez"), { referredByKey: "528446683688", referredByName: "Ana Lopez" });
  assert.deepEqual(referralOf(true, "5218446683688", null), { referredByKey: "528446683688", referredByName: null });
});

test("a visit for the person writing has no recommendation", () => {
  assert.deepEqual(referralOf(false, "5218446683688", "Ana Lopez"), { referredByKey: null, referredByName: null });
});

test("the sender sees their own visits and the ones they booked for others", () => {
  assert.deepEqual(visitsOfSender("5218446683688"), {
    OR: [{ customerPhone: "5218446683688" }, { referredByKey: "528446683688" }],
  });
});

test("a sender without a usable phone key still matches the phone as typed", () => {
  assert.deepEqual(visitsOfSender("123"), { OR: [{ customerPhone: "123" }] });
});
