// A chat's help state: it opens, goes up in priority, never goes down, and is cleared when someone handles it.
import test from "node:test";
import assert from "node:assert/strict";
import { NO_HELP, raiseHelp, resolveHelp, unansweredReason, type HelpState } from "../src/lib/help-state";
import { HELP_PRIORITY } from "../src/lib/help-reasons";

const NOW = new Date("2026-11-18T16:00:00.000Z");
const EARLIER = new Date("2026-11-18T15:30:00.000Z");

test("a chat with no help opens with the reason, its priority and the time, and the responder is told", () => {
  const result = raiseHelp(NO_HELP, "purchase_intent", NOW);
  assert.deepEqual(result.state, { reason: "purchase_intent", priority: HELP_PRIORITY.MEDIUM, requestedAt: NOW });
  assert.equal(result.notify, true);
});

test("a higher priority reason replaces the lower one, keeps the first request time and notifies again", () => {
  const open: HelpState = { reason: "purchase_intent", priority: HELP_PRIORITY.MEDIUM, requestedAt: EARLIER };
  const result = raiseHelp(open, "person_requested", NOW);
  assert.deepEqual(result.state, { reason: "person_requested", priority: HELP_PRIORITY.HIGH, requestedAt: EARLIER });
  assert.equal(result.notify, true);
});

test("the same reason again changes nothing and does not notify again", () => {
  const open: HelpState = { reason: "person_requested", priority: HELP_PRIORITY.HIGH, requestedAt: EARLIER };
  const result = raiseHelp(open, "person_requested", NOW);
  assert.deepEqual(result.state, open);
  assert.equal(result.notify, false);
});

test("a lower priority reason never lowers an open request", () => {
  const open: HelpState = { reason: "person_requested", priority: HELP_PRIORITY.HIGH, requestedAt: EARLIER };
  const result = raiseHelp(open, "purchase_intent", NOW);
  assert.deepEqual(result.state, open);
  assert.equal(result.notify, false);
});

test("a reason that is turned off in version 1 does not open a request", () => {
  const result = raiseHelp(NO_HELP, "urgency", NOW);
  assert.deepEqual(result.state, NO_HELP);
  assert.equal(result.notify, false);
});

test("resolving clears the state", () => {
  const open: HelpState = { reason: "send_failed", priority: HELP_PRIORITY.HIGH, requestedAt: EARLIER };
  assert.deepEqual(resolveHelp(open), NO_HELP);
});

test("raiseHelp does not change the state it receives", () => {
  const open: HelpState = { reason: "purchase_intent", priority: HELP_PRIORITY.MEDIUM, requestedAt: EARLIER };
  const copy = { ...open };
  raiseHelp(open, "person_requested", NOW);
  assert.deepEqual(open, copy);
});

// "Unanswered": the customer's last message has no reply. Medium after N minutes, high after twice as long.
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

test("an unanswered message below the limit is not help yet", () => {
  assert.equal(unansweredReason(NOW, minutesAgo(9), 10), null);
});

test("an unanswered message at the limit is medium", () => {
  assert.equal(unansweredReason(NOW, minutesAgo(10), 10), "unanswered");
});

test("an unanswered message at twice the limit is high", () => {
  assert.equal(unansweredReason(NOW, minutesAgo(20), 10), "unanswered_long");
  assert.equal(unansweredReason(NOW, minutesAgo(19), 10), "unanswered");
});
