// tests/messaging-policy.test.ts
// Ban prevention: the single decision for each outbound message. Run: npx tsx --test tests/messaging-policy.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, type PolicyInput } from "../src/lib/messaging/policy";

const base: PolicyInput = {
  purpose: "TRANSACTIONAL",
  killSwitch: { global: false, tenant: false, instance: false },
  riskState: "NORMAL",
  optedOut: false,
  consent: "YES",
  mode: "ENFORCE",
  quietHours: false,
  urgent: false,
  recipientIsTeam: false,
};
const withInput = (over: Partial<PolicyInput>): PolicyInput => ({ ...base, ...over });

test("a visit reminder with consent is allowed and not stopped", () => {
  assert.deepEqual(decide(base), { decision: "ALLOWED", wouldBlock: false, stopped: false });
});

test("any kill switch stops every purpose, even a customer reply", () => {
  for (const killSwitch of [
    { global: true, tenant: false, instance: false },
    { global: false, tenant: true, instance: false },
    { global: false, tenant: false, instance: true },
  ]) {
    assert.equal(decide(withInput({ killSwitch, purpose: "CUSTOMER_REPLY" })).decision, "BLOCKED_KILL_SWITCH");
  }
});

test("a restricted or suspended instance stops everything", () => {
  for (const riskState of ["SENDING_PAUSED", "REQUIRES_MANUAL_REVIEW", "SUSPENDED"] as const) {
    assert.equal(decide(withInput({ riskState, purpose: "CUSTOMER_REPLY" })).decision, "BLOCKED_RISK_STATE");
  }
});

test("a degraded instance still sends (degraded is a warning, not a stop)", () => {
  assert.equal(decide(withInput({ riskState: "DEGRADED" })).decision, "ALLOWED");
});

test("marketing is always blocked", () => {
  assert.equal(decide(withInput({ purpose: "MARKETING" })).decision, "BLOCKED_MARKETING");
});

test("team notices go only to the business's own numbers, without customer consent", () => {
  assert.equal(decide(withInput({ purpose: "INTERNAL", consent: "NO", recipientIsTeam: true })).decision, "ALLOWED");
  assert.equal(decide(withInput({ purpose: "INTERNAL", recipientIsTeam: false })).decision, "BLOCKED_NOT_TEAM");
});

test("opt-out blocks transactional messages and customer replies in both modes", () => {
  for (const mode of ["SHADOW", "ENFORCE"] as const) {
    const transactional = decide(withInput({ optedOut: true, mode }));
    assert.equal(transactional.decision, "BLOCKED_OPT_OUT");
    assert.equal(transactional.stopped, true);
    assert.equal(decide(withInput({ optedOut: true, mode, purpose: "CUSTOMER_REPLY" })).decision, "BLOCKED_OPT_OUT");
  }
});

test("no consent is only measured in SHADOW: the message still goes out", () => {
  const shadow = decide(withInput({ consent: "NO", mode: "SHADOW" }));
  assert.equal(shadow.decision, "BLOCKED_NO_CONSENT");
  assert.equal(shadow.wouldBlock, true);
  assert.equal(shadow.stopped, false);
});

test("no consent stops the message in ENFORCE", () => {
  assert.equal(decide(withInput({ consent: "NO", mode: "ENFORCE" })).stopped, true);
});

test("grandfathered visits (created before enforcement) are not blocked for consent", () => {
  assert.equal(decide(withInput({ consent: "GRANDFATHERED", mode: "ENFORCE" })).decision, "ALLOWED");
});

test("quiet hours defer a non-urgent visit message, they do not drop it", () => {
  const r = decide(withInput({ quietHours: true }));
  assert.equal(r.decision, "DEFER_QUIET_HOURS");
  assert.equal(r.stopped, false);
});

test("an urgent message is not held for quiet hours", () => {
  assert.equal(decide(withInput({ quietHours: true, urgent: true })).decision, "ALLOWED");
});

test("a customer reply is not held for quiet hours (the customer wrote first)", () => {
  assert.equal(decide(withInput({ purpose: "CUSTOMER_REPLY", quietHours: true })).decision, "ALLOWED");
});
