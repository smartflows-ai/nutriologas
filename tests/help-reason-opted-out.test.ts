// tests/help-reason-opted-out.test.ts
// Run: npx tsx --test tests/help-reason-opted-out.test.ts
// QA 2026-11-20: a patient who asked to stop messages lands in "Necesitan ayuda", and a person can reactivate
// the messages after confirming with the patient. Marking the chat handled never turns the bot back on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HELP_PRIORITY, isHelpReason, isReasonEnabled, pausesBot, priorityOf, isTenantWide } from "../src/lib/help-reasons";
import { reactivateMessagingPatch, resumeBotPatch, OPTED_OUT_PAUSE } from "../src/lib/help-actions";

test("opted_out is a help reason, on, medium priority, per chat", () => {
  assert.equal(isHelpReason("opted_out"), true);
  assert.equal(isReasonEnabled("opted_out"), true);
  assert.equal(priorityOf("opted_out"), HELP_PRIORITY.MEDIUM);
  assert.equal(isTenantWide("opted_out"), false);
});

test("opted_out does not count as a hand-off pause, so marking handled keeps the bot off", () => {
  assert.equal(pausesBot("opted_out"), false);
  assert.deepEqual(resumeBotPatch(OPTED_OUT_PAUSE), {});
});

test("reactivating clears the opt-out, records who and when, and turns the bot on only after an opt-out pause", () => {
  const now = new Date("2026-11-20T15:00:00Z");
  const patch = reactivateMessagingPatch("user-1", now, OPTED_OUT_PAUSE, "opted_out");
  assert.equal(patch.optedOutAt, null);
  assert.equal(patch.optedOutSource, null);
  assert.equal(patch.messagingReactivatedById, "user-1");
  assert.equal(patch.messagingReactivatedAt, now);
  assert.equal(patch.botEnabled, true);
  assert.equal(patch.botPausedReason, null);
  assert.equal(patch.helpReason, null);
  assert.equal(patch.helpPriority, 0);
});

test("reactivating keeps the owner's own manual pause and an unrelated help request", () => {
  const now = new Date("2026-11-20T15:00:00Z");
  const patch = reactivateMessagingPatch("user-1", now, "manual", "purchase_intent");
  assert.equal("botEnabled" in patch, false);
  assert.equal("helpReason" in patch, false);
  assert.equal(patch.optedOutAt, null);
});
