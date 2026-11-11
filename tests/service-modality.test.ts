// tests/service-modality.test.ts
// Visit modality per service: the business setting is the default, the service setting overrides it.
// Run with: npx tsx --test tests/service-modality.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { effectiveModes, modalityModeFor, resolveModality } from "../src/lib/patient-intake";

test("a service that sets nothing follows the business", () => {
  assert.deepEqual(effectiveModes("IN_PERSON", null), ["IN_PERSON"]);
  assert.deepEqual(effectiveModes("ONLINE", null), ["ONLINE"]);
  assert.deepEqual(effectiveModes("BOTH", null), ["IN_PERSON", "ONLINE"]);
});

test("a service that sets its own modes wins over the business", () => {
  assert.deepEqual(effectiveModes("BOTH", "IN_PERSON"), ["IN_PERSON"]);
  assert.deepEqual(effectiveModes("BOTH", "ONLINE"), ["ONLINE"]);
  assert.deepEqual(effectiveModes("IN_PERSON", "ONLINE"), ["ONLINE"]);
  assert.deepEqual(effectiveModes("ONLINE", "IN_PERSON"), ["IN_PERSON"]);
  assert.deepEqual(effectiveModes("IN_PERSON", "BOTH"), ["IN_PERSON", "ONLINE"]);
});

test("the mode the bot works with, for every business and service combination", () => {
  const cases: Array<["IN_PERSON" | "ONLINE" | "BOTH", "IN_PERSON" | "ONLINE" | "BOTH" | null, string]> = [
    ["IN_PERSON", null, "IN_PERSON"],
    ["IN_PERSON", "IN_PERSON", "IN_PERSON"],
    ["IN_PERSON", "ONLINE", "ONLINE"],
    ["IN_PERSON", "BOTH", "ASK"],
    ["ONLINE", null, "ONLINE"],
    ["ONLINE", "IN_PERSON", "IN_PERSON"],
    ["ONLINE", "ONLINE", "ONLINE"],
    ["ONLINE", "BOTH", "ASK"],
    ["BOTH", null, "ASK"],
    ["BOTH", "IN_PERSON", "IN_PERSON"],
    ["BOTH", "ONLINE", "ONLINE"],
    ["BOTH", "BOTH", "ASK"],
  ];
  for (const [business, service, expected] of cases) {
    assert.equal(modalityModeFor(business, service), expected, `${business} + ${service}`);
  }
});

test("an in-person-only service in a business that offers both is not asked, and online is refused", () => {
  assert.deepEqual(resolveModality("BOTH", undefined, "IN_PERSON"), { ok: true, modality: "IN_PERSON" });
  assert.deepEqual(resolveModality("BOTH", "IN_PERSON", "IN_PERSON"), { ok: true, modality: "IN_PERSON" });
  assert.deepEqual(resolveModality("BOTH", "ONLINE", "IN_PERSON"), { ok: false, error: "modality_not_available" });
});

test("an online-only service refuses in person", () => {
  assert.deepEqual(resolveModality("BOTH", undefined, "ONLINE"), { ok: true, modality: "ONLINE" });
  assert.deepEqual(resolveModality("BOTH", "IN_PERSON", "ONLINE"), { ok: false, error: "modality_not_available" });
});

test("a service marked both asks the patient, even in a single-mode business", () => {
  assert.deepEqual(resolveModality("IN_PERSON", undefined, "BOTH"), { ok: false, error: "modality_required" });
  assert.deepEqual(resolveModality("IN_PERSON", "ONLINE", "BOTH"), { ok: true, modality: "ONLINE" });
});

test("a service that follows the business keeps today's behavior", () => {
  assert.deepEqual(resolveModality("BOTH", undefined, null), { ok: false, error: "modality_required" });
  assert.deepEqual(resolveModality("BOTH", "ONLINE", null), { ok: true, modality: "ONLINE" });
  assert.deepEqual(resolveModality("IN_PERSON", undefined, null), { ok: true, modality: "IN_PERSON" });
});

test("a value that is not a modality is never accepted when the patient must choose", () => {
  assert.deepEqual(resolveModality("BOTH", "presencial", null), { ok: false, error: "modality_required" });
  assert.deepEqual(resolveModality("BOTH", "presencial", "BOTH"), { ok: false, error: "modality_required" });
});

test("the old two-argument call (workflow not re-imported) is unchanged", () => {
  assert.deepEqual(resolveModality("IN_PERSON", "ONLINE"), { ok: true, modality: "IN_PERSON" });
  assert.deepEqual(resolveModality("BOTH", undefined), { ok: false, error: "modality_required" });
});

test("with the per-service rule, a single-mode business refuses the other mode instead of changing it silently", () => {
  assert.deepEqual(resolveModality("IN_PERSON", "ONLINE", null), { ok: false, error: "modality_not_available" });
  assert.deepEqual(resolveModality("ONLINE", "IN_PERSON", null), { ok: false, error: "modality_not_available" });
});
