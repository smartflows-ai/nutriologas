// Registry of the reasons that mark a WhatsApp chat as "needs a person". Priorities come from here, not from the screen.
import test from "node:test";
import assert from "node:assert/strict";
import { HELP_PRIORITY, HELP_REASONS, isHelpReason, priorityOf, isReasonEnabled, pausesBot, isTenantWide } from "../src/lib/help-reasons";

test("a purchase is medium and a request for a person is high", () => {
  assert.equal(priorityOf("purchase_intent"), HELP_PRIORITY.MEDIUM);
  assert.equal(priorityOf("person_requested"), HELP_PRIORITY.HIGH);
});

test("a failed send and a failed agent are high priority", () => {
  assert.equal(priorityOf("send_failed"), HELP_PRIORITY.HIGH);
  assert.equal(priorityOf("agent_failed"), HELP_PRIORITY.HIGH);
});

test("an unanswered message is medium and becomes high when it waits much longer", () => {
  assert.equal(priorityOf("unanswered"), HELP_PRIORITY.MEDIUM);
  assert.equal(priorityOf("unanswered_long"), HELP_PRIORITY.HIGH);
});

test("priorities only go up in importance: none < medium < high < critical", () => {
  assert.ok(HELP_PRIORITY.NONE < HELP_PRIORITY.MEDIUM);
  assert.ok(HELP_PRIORITY.MEDIUM < HELP_PRIORITY.HIGH);
  assert.ok(HELP_PRIORITY.HIGH < HELP_PRIORITY.CRITICAL);
});

test("version 1 turns on the reasons that already have a signal and leaves the rest off", () => {
  for (const on of ["purchase_intent", "person_requested", "send_failed", "agent_failed", "unanswered", "unanswered_long", "credits_exhausted", "online_link_missing"] as const) {
    assert.equal(isReasonEnabled(on), true, on);
  }
  for (const off of ["tool_loop", "reminder_failed", "urgency"] as const) {
    assert.equal(isReasonEnabled(off), false, off);
  }
});

test("isHelpReason accepts only registered reasons", () => {
  assert.equal(isHelpReason("purchase_intent"), true);
  assert.equal(isHelpReason("owner_reply"), false);
  assert.equal(isHelpReason(""), false);
  assert.equal(isHelpReason(undefined), false);
});

test("every reason has a priority above none and a label key", () => {
  for (const [reason, info] of Object.entries(HELP_REASONS)) {
    assert.ok(info.priority > HELP_PRIORITY.NONE, reason);
    assert.ok(info.labelKey.length > 0, reason);
  }
});

test("a booking over the daily limit is medium priority, needs a person and pauses the bot (ticket #141)", () => {
  assert.equal(isHelpReason("booking_limit"), true);
  assert.equal(priorityOf("booking_limit"), HELP_PRIORITY.MEDIUM);
  assert.equal(isReasonEnabled("booking_limit"), true);
  assert.equal(pausesBot("booking_limit"), true);
  assert.equal(isTenantWide("booking_limit"), false);
  assert.equal(HELP_REASONS.booking_limit.labelKey, "bookingLimit");
});

test("a long unanswered wait shares the label of the unanswered one", () => {
  assert.equal(HELP_REASONS.unanswered_long.labelKey, HELP_REASONS.unanswered.labelKey);
});

test("the bot steps aside only when a person has to take over the conversation", () => {
  assert.equal(pausesBot("purchase_intent"), true);
  assert.equal(pausesBot("person_requested"), true);
  assert.equal(pausesBot("urgency"), true);
  for (const keepsAnswering of ["send_failed", "agent_failed", "unanswered", "unanswered_long", "credits_exhausted", "online_link_missing"] as const) {
    assert.equal(pausesBot(keepsAnswering), false, keepsAnswering);
  }
});

test("reasons that hit the whole business notify once per hour, not once per chat", () => {
  for (const wide of ["send_failed", "agent_failed", "credits_exhausted"] as const) {
    assert.equal(isTenantWide(wide), true, wide);
  }
  for (const perChat of ["purchase_intent", "person_requested", "unanswered", "unanswered_long", "online_link_missing"] as const) {
    assert.equal(isTenantWide(perChat), false, perChat);
  }
});
