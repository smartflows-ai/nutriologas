// tests/booking-limit.test.ts
// Ticket #141: at most 3 active visits per person per day through the bot; the fourth goes to a person. Pure rules,
// no database. The day is the business's own day (Tenant.timeZone), never the UTC day.
// Run with: npx tsx --test tests/booking-limit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_VISIT_STATUSES,
  MAX_ACTIVE_VISITS_PER_DAY,
  dailyLimitBody,
  dayRangeOf,
  limitDecision,
  visitScopes,
} from "../src/lib/booking-limit";

test("the limit is a named constant of 3 and only pending and confirmed visits count", () => {
  assert.equal(MAX_ACTIVE_VISITS_PER_DAY, 3);
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

test("the day runs from midnight to midnight of the business zone, not UTC", () => {
  const cancun = dayRangeOf("2026-11-24", "America/Cancun");
  assert.equal(cancun.start.toISOString(), "2026-11-24T05:00:00.000Z");
  assert.equal(cancun.end.toISOString(), "2026-11-25T05:00:00.000Z");
  const mexico = dayRangeOf("2026-11-24", "America/Mexico_City");
  assert.equal(mexico.start.toISOString(), "2026-11-24T06:00:00.000Z");
});

test("23:30 and 00:30 of the business clock fall on different days", () => {
  const day = dayRangeOf("2026-11-24", "America/Cancun");
  const late = new Date("2026-11-25T04:30:00.000Z"); // 23:30 in Cancun on the 24th
  const after = new Date("2026-11-25T05:30:00.000Z"); // 00:30 in Cancun on the 25th
  assert.ok(late >= day.start && late < day.end);
  assert.ok(!(after >= day.start && after < day.end));
});

test("a day with a clock change is 25 or 23 hours long", () => {
  const fallBack = dayRangeOf("2026-11-01", "America/New_York");
  assert.equal(fallBack.end.getTime() - fallBack.start.getTime(), 25 * 3_600_000);
  const springForward = dayRangeOf("2026-03-08", "America/New_York");
  assert.equal(springForward.end.getTime() - springForward.start.getTime(), 23 * 3_600_000);
});

test("who is counted: the patient's own visits, and the person writing: their own plus the ones they booked for others", () => {
  assert.deepEqual(visitScopes("P", "W"), {
    patient: { patientKey: "P" },
    writer: { OR: [{ patientKey: "W" }, { referredByKey: "W" }] },
  });
});

test("a person booking for themselves is still counted for what they booked for others (the mother case)", () => {
  // 3 visits for her children (patientKey = each child, referredByKey = W) and then one for herself (patientKey = W).
  const scopes = visitScopes("W", "W");
  assert.deepEqual(scopes.writer, { OR: [{ patientKey: "W" }, { referredByKey: "W" }] });
  // The writer count already includes the patient's own visits, so the patient query is skipped.
  assert.equal(scopes.patient, null);
  // With the 3 visits made for the children the writer count is 3 and the visit for herself is refused by the writer.
  assert.deepEqual(limitDecision({ patient: 0, writer: 3 }), { allowed: false, by: "writer", count: 3, max: 3 });
});

test("without the writer's number only the patient is counted", () => {
  assert.deepEqual(visitScopes("P", null), { patient: { patientKey: "P" }, writer: null });
});

test("the refusal body tells the agent not to book and not to offer another time that day", () => {
  const body = dailyLimitBody(true);
  assert.equal(body.success, false);
  assert.equal(body.error, "daily_limit_reached");
  assert.equal(body.max, 3);
  assert.equal(body.handedOff, true);
  assert.match(body.message, /no agendes/i);
  assert.match(body.message, /persona del equipo/i);
});

test("without a chat to hand over, the agent is told not to promise a person", () => {
  const body = dailyLimitBody(false);
  assert.equal(body.handedOff, false);
  assert.match(body.message, /no prometas/i);
});

test("the refusal texts name no provider and no one kind of business", () => {
  for (const handedOff of [true, false]) {
    const text = dailyLimitBody(handedOff).message;
    assert.doesNotMatch(text, /claude|anthropic|openai|gpt|openrouter|evolution|n8n|baileys/i);
    assert.doesNotMatch(text, /consultorio|paciente|cl[ií]nica|doctor/i);
  }
});
