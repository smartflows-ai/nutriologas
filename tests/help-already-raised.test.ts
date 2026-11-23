// tests/help-already-raised.test.ts
// Ticket #141 (execution 22960): after the server handed a chat over (booking_limit), the model called request_human_help
// and changed the reason and told the owner a second time. A reason the SERVER raised and that is still open is final.
// Run with: npx tsx --test tests/help-already-raised.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { alreadyRaisedBody, serverReasonOpen } from "../src/lib/help-already-raised";

const SERVER = new Set(["opted_out", "booking_limit", "unsupported_media"]);
const chat = (helpReason: string | null, helpPriority: number) => ({ helpReason, helpPriority });

test("a server reason that is still open blocks the model's request", () => {
  for (const reason of ["booking_limit", "opted_out", "unsupported_media"]) {
    assert.equal(serverReasonOpen([chat(reason, 2)], SERVER), true, reason);
  }
});

test("with no open reason the request goes on as today", () => {
  assert.equal(serverReasonOpen([], SERVER), false);
  assert.equal(serverReasonOpen([chat(null, 0)], SERVER), false);
});

test("a reason raised by the model (purchase_intent) does not block: it can still go up in priority", () => {
  assert.equal(serverReasonOpen([chat("purchase_intent", 3)], SERVER), false);
  assert.equal(serverReasonOpen([chat("person_requested", 3)], SERVER), false);
});

test("a server reason that was already handled (priority 0) does not block", () => {
  assert.equal(serverReasonOpen([chat("booking_limit", 0)], SERVER), false);
});

test("any chat row of the contact counts", () => {
  assert.equal(serverReasonOpen([chat(null, 0), chat("booking_limit", 2)], SERVER), true);
});

test("the answer for the agent says a person is already told and promises nothing else", () => {
  const body = alreadyRaisedBody();
  assert.equal(body.raised, false);
  assert.equal(body.reason, "already_raised");
  assert.match(body.message, /ya hay una persona avisada/i);
  assert.match(body.message, /no prometas/i);
  assert.doesNotMatch(body.message, /claude|anthropic|openai|gpt|openrouter|evolution|n8n|baileys|consultorio|paciente|cl[ií]nica|doctor/i);
});

test("handleHelpRequest answers already_raised before pausing or notifying, and the server path is not guarded", () => {
  const handler = readFileSync("src/lib/help-handler.ts", "utf8");
  assert.match(handler, /serverReasonOpen\(/);
  assert.match(handler, /already_raised/);
  assert.match(handler, /guardServerReasons: true/, "only handleHelpRequest turns the guard on");
  const guardAt = handler.indexOf("serverReasonOpen(");
  assert.ok(guardAt < handler.indexOf("updateMany("), "before the bot is paused");
  assert.ok(guardAt < handler.indexOf("raiseHelpOnChat(realHelpDeps"), "before anyone is told");
});

test("the booking limit message tells the agent the team was already told and not to call request_human_help", async () => {
  const { visitLimitBody } = await import("../src/lib/booking-limit");
  assert.match(visitLimitBody(true).message, /equipo ya fue avisado/i);
  assert.match(visitLimitBody(true).message, /no llames a request_human_help/i);
});
