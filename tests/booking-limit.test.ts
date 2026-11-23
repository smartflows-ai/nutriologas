// tests/booking-limit.test.ts
// Ticket #141: a person has at most 3 ACTIVE FUTURE visits in total (any day), through the bot and the public web
// booking; the fourth is refused. Pure rules, no database.
// Run with: npx tsx --test tests/booking-limit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_VISIT_STATUSES,
  MAX_ACTIVE_FUTURE_VISITS,
  futureRange,
  limitDecision,
  visitLimitBody,
  visitScopes,
  webVisitScope,
} from "../src/lib/booking-limit";

test("the limit is a named constant of 3 and only pending and confirmed visits count", () => {
  assert.equal(MAX_ACTIVE_FUTURE_VISITS, 3);
  assert.deepEqual([...ACTIVE_VISIT_STATUSES], ["PENDING", "CONFIRMED"]);
});

test("0, 1 and 2 active visits still allow another one; the fourth is refused", () => {
  for (const count of [0, 1, 2]) assert.deepEqual(limitDecision({ patient: count, writer: count }), { allowed: true }, String(count));
  assert.deepEqual(limitDecision({ patient: 3, writer: 3 }), { allowed: false, by: "patient", count: 3, max: 3 });
  assert.equal(limitDecision({ patient: 5, writer: 0 }).allowed, false);
});

test("it is refused when the patient OR the person writing reached the limit", () => {
  assert.deepEqual(limitDecision({ patient: 1, writer: 3 }), { allowed: false, by: "writer", count: 3, max: 3 });
  assert.deepEqual(limitDecision({ patient: 3, writer: 1 }), { allowed: false, by: "patient", count: 3, max: 3 });
  assert.deepEqual(limitDecision({ patient: 2, writer: 2 }), { allowed: true });
});

test("a different max is respected", () => {
  assert.equal(limitDecision({ patient: 1, writer: 1 }, 1).allowed, false);
  assert.equal(limitDecision({ patient: 0, writer: 0 }, 1).allowed, true);
});

test("the range is 'from now on', whatever the day of the visit: visits of several days all count, past ones do not", () => {
  const now = new Date("2026-11-22T15:00:00.000Z");
  assert.deepEqual(futureRange(now), { gt: now });
  const range = futureRange(now);
  const dates = ["2026-11-23T16:00:00.000Z", "2026-12-05T16:00:00.000Z", "2027-02-01T16:00:00.000Z"].map((d) => new Date(d));
  assert.equal(dates.filter((d) => d > range.gt).length, 3, "three visits on three different days");
  assert.ok(!(new Date("2026-11-20T16:00:00.000Z") > range.gt), "a past visit is not counted");
  assert.ok(!(now > range.gt), "a visit at this very instant is not future");
});

test("who is counted: the patient's own visits, and the person writing: their own plus the ones they booked for others", () => {
  assert.deepEqual(visitScopes("P", "W"), {
    patient: { patientKey: "P" },
    writer: { OR: [{ patientKey: "W" }, { referredByKey: "W" }] },
  });
});

test("a person booking for themselves is still counted for what they booked for others (the mother case)", () => {
  const scopes = visitScopes("W", "W");
  assert.deepEqual(scopes.writer, { OR: [{ patientKey: "W" }, { referredByKey: "W" }] });
  assert.equal(scopes.patient, null);
  assert.deepEqual(limitDecision({ patient: 0, writer: 3 }), { allowed: false, by: "writer", count: 3, max: 3 });
});

test("without the writer's number only the patient is counted", () => {
  assert.deepEqual(visitScopes("P", null), { patient: { patientKey: "P" }, writer: null });
});

test("web: a guest is counted by the phone of the visit; a signed-in customer also by their account", () => {
  assert.deepEqual(webVisitScope("P", null), { patientKey: "P" });
  assert.deepEqual(webVisitScope("P", "U1"), { OR: [{ patientKey: "P" }, { userId: "U1" }] });
});

test("the refusal body tells the agent not to book and a person will take it", () => {
  const body = visitLimitBody(true);
  assert.equal(body.success, false);
  assert.equal(body.error, "visit_limit_reached");
  assert.equal(body.max, 3);
  assert.equal(body.handedOff, true);
  assert.match(body.message, /ya tiene 3 citas activas/i);
  assert.match(body.message, /no agendes/i);
  assert.match(body.message, /persona del equipo/i);
});

test("without a chat to hand over, the agent is told not to promise a person", () => {
  const body = visitLimitBody(false);
  assert.equal(body.handedOff, false);
  assert.match(body.message, /no prometas/i);
});

test("the refusal texts name no provider and no one kind of business", () => {
  for (const handedOff of [true, false]) {
    const text = visitLimitBody(handedOff).message;
    assert.doesNotMatch(text, /claude|anthropic|openai|gpt|openrouter|evolution|n8n|baileys/i);
    assert.doesNotMatch(text, /consultorio|paciente|cl[ií]nica|doctor/i);
    assert.doesNotMatch(text, /por dia|ese dia|mismo dia/i, "the limit is total, not per day");
  }
});
