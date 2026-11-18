// What the team can do with a chat that needs help: take it, mark it handled, assign it.
// Each action returns the fields to write; the route only hands them to Prisma.
import test from "node:test";
import assert from "node:assert/strict";
import { assignPatch, canAssignHelp, ownerTookOverPatch, repliedPatch, resolvePatch, resumeBotPatch, takePatch } from "../src/lib/help-actions";

const NOW = new Date("2026-11-18T16:00:00.000Z");

test("taking a chat puts the person in charge, stops the escalation clock and pauses the bot that was answering", () => {
  assert.deepEqual(takePatch("u1", NOW, true), { assignedToId: "u1", helpTakenAt: NOW, botEnabled: false, botPausedReason: "taken" });
});

test("taking a chat the bot already stopped answering keeps the reason it was paused", () => {
  assert.deepEqual(takePatch("u1", NOW, false), { assignedToId: "u1", helpTakenAt: NOW });
});

test("marking handled clears the whole help state but keeps who is in charge", () => {
  assert.deepEqual(resolvePatch(), {
    helpReason: null,
    helpPriority: 0,
    helpRequestedAt: null,
    helpAssigneeNotifiedAt: null,
    helpOwnerNotifiedAt: null,
    helpTakenAt: null,
    helpCustomerWroteAt: null,
  });
  assert.equal("assignedToId" in resolvePatch(), false);
});

test("answering from the panel hands the chat to whoever answered and marks it handled", () => {
  assert.deepEqual(repliedPatch("u2"), { ...resolvePatch(), assignedToId: "u2" });
});

test("assigning sets the assistant and the time it was given, and null leaves the chat unassigned", () => {
  assert.deepEqual(assignPatch("u3", NOW), { assignedToId: "u3", helpAssignedAt: NOW });
  assert.deepEqual(assignPatch(null, NOW), { assignedToId: null, helpAssignedAt: null });
});

test("only the owner assigns chats", () => {
  assert.equal(canAssignHelp("ADMIN"), true);
  assert.equal(canAssignHelp("STAFF"), false);
  assert.equal(canAssignHelp("CUSTOMER"), false);
});

test("marking handled turns the bot back on when the hand-off is what paused it", () => {
  for (const reason of ["purchase_intent", "person_requested", "urgency"]) {
    assert.deepEqual(resumeBotPatch(reason), { botEnabled: true, botPausedReason: null }, reason);
  }
});

test("marking handled leaves the bot as it was when the owner paused it or a person is writing", () => {
  assert.deepEqual(resumeBotPatch("manual"), {});
  assert.deepEqual(resumeBotPatch("owner_reply"), {});
  assert.deepEqual(resumeBotPatch(null), {});
});

test("a reason that does not pause the bot never turns it on", () => {
  assert.deepEqual(resumeBotPatch("send_failed"), {});
  assert.deepEqual(resumeBotPatch("unanswered"), {});
});

test("when a person writes into a chat paused by a hand-off, the pause becomes 'a person is writing'", () => {
  assert.deepEqual(ownerTookOverPatch("purchase_intent"), { botPausedReason: "owner_reply" });
  assert.deepEqual(ownerTookOverPatch("person_requested"), { botPausedReason: "owner_reply" });
});

test("a pause that is not a hand-off keeps its reason when a person writes", () => {
  assert.deepEqual(ownerTookOverPatch("manual"), {});
  assert.deepEqual(ownerTookOverPatch("owner_reply"), {});
  assert.deepEqual(ownerTookOverPatch(null), {});
});

test("a pause that came from taking the chat is lifted when it is marked handled, and becomes 'a person is writing' when a person writes", () => {
  assert.deepEqual(resumeBotPatch("taken"), { botEnabled: true, botPausedReason: null });
  assert.deepEqual(ownerTookOverPatch("taken"), { botPausedReason: "owner_reply" });
});
