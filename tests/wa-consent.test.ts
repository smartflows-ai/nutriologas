// tests/wa-consent.test.ts
// Run: npx tsx --test tests/wa-consent.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mayStartMessage } from "../src/lib/wa-consent";

const T0 = new Date("2026-11-01T00:00:00Z"); // enforcement began here
const BEFORE = new Date("2026-10-20T00:00:00Z");
const AFTER = new Date("2026-11-10T00:00:00Z");
const SOME = new Date("2026-11-11T00:00:00Z");

test("opt-out always blocks, in either mode", () => {
  for (const mode of ["SHADOW", "ENFORCE"] as const) {
    const d = mayStartMessage({ optedOutAt: SOME, consentAt: SOME, createdAt: AFTER, enforcedAt: T0, mode });
    assert.equal(d.allowed, false);
    assert.equal(d.reason, "opted_out");
  }
});

test("explicit consent is allowed", () => {
  const d = mayStartMessage({ optedOutAt: null, consentAt: SOME, createdAt: AFTER, enforcedAt: T0, mode: "ENFORCE" });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "consent");
  assert.equal(d.shadow, false);
});

test("a visit created before enforcement is grandfathered", () => {
  const d = mayStartMessage({ optedOutAt: null, consentAt: null, createdAt: BEFORE, enforcedAt: T0, mode: "ENFORCE" });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "grandfathered");
});

test("no consent, created after enforcement, ENFORCE mode: blocked", () => {
  const d = mayStartMessage({ optedOutAt: null, consentAt: null, createdAt: AFTER, enforcedAt: T0, mode: "ENFORCE" });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "no_consent");
});

test("no consent, SHADOW mode: allowed but flagged as a would-be block", () => {
  const d = mayStartMessage({ optedOutAt: null, consentAt: null, createdAt: AFTER, enforcedAt: null, mode: "SHADOW" });
  assert.equal(d.allowed, true);
  assert.equal(d.shadow, true);
  assert.equal(d.reason, "no_consent");
});

test("opt-out still blocks in SHADOW mode (it is a hard rule, not a policy under test)", () => {
  const d = mayStartMessage({ optedOutAt: SOME, consentAt: null, createdAt: AFTER, enforcedAt: null, mode: "SHADOW" });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "opted_out");
});

test("ENFORCE with no enforcedAt timestamp: nothing is grandfathered", () => {
  const d = mayStartMessage({ optedOutAt: null, consentAt: null, createdAt: BEFORE, enforcedAt: null, mode: "ENFORCE" });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "no_consent");
});
