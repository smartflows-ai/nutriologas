// Who is told first about a chat that needs help, and when the owner is told next.
import test from "node:test";
import assert from "node:assert/strict";
import { escalationDue, helpNotifyPlan, isValidEscalationMinutes, pickFirstResponder, type Assistant } from "../src/lib/help-routing";

const NOW = new Date("2026-11-18T16:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

function assistant(id: string, over: Partial<Assistant> = {}): Assistant {
  return { id, active: true, whatsappNumber: "+5215512345678", openCount: 0, lastNotifiedAt: null, ...over };
}

test("the assistant assigned to the chat goes first", () => {
  const result = pickFirstResponder({ assignedToId: "b", assistants: [assistant("a"), assistant("b")] });
  assert.deepEqual(result, { kind: "assistant", id: "b", source: "assigned" });
});

test("an assigned assistant that is inactive or has no number is skipped and the queue decides", () => {
  const inactive = pickFirstResponder({ assignedToId: "b", assistants: [assistant("a"), assistant("b", { active: false })] });
  assert.deepEqual(inactive, { kind: "assistant", id: "a", source: "queue" });
  const noNumber = pickFirstResponder({ assignedToId: "b", assistants: [assistant("a"), assistant("b", { whatsappNumber: null })] });
  assert.deepEqual(noNumber, { kind: "assistant", id: "a", source: "queue" });
});

test("with nobody assigned, the queue picks the assistant with the fewest open requests", () => {
  const result = pickFirstResponder({ assignedToId: null, assistants: [assistant("a", { openCount: 3 }), assistant("b", { openCount: 1 })] });
  assert.deepEqual(result, { kind: "assistant", id: "b", source: "queue" });
});

test("on a tie in open requests, the one that has gone longest without being notified goes first", () => {
  const result = pickFirstResponder({
    assignedToId: null,
    assistants: [assistant("a", { lastNotifiedAt: minutesAgo(5) }), assistant("b", { lastNotifiedAt: minutesAgo(50) })],
  });
  assert.deepEqual(result, { kind: "assistant", id: "b", source: "queue" });
});

test("an assistant never notified counts as the oldest", () => {
  const result = pickFirstResponder({
    assignedToId: null,
    assistants: [assistant("a", { lastNotifiedAt: minutesAgo(5) }), assistant("b", { lastNotifiedAt: null })],
  });
  assert.equal(result.kind === "assistant" && result.id, "b");
});

test("a complete tie is decided by id so the answer does not depend on list order", () => {
  const one = pickFirstResponder({ assignedToId: null, assistants: [assistant("b"), assistant("a")] });
  const two = pickFirstResponder({ assignedToId: null, assistants: [assistant("a"), assistant("b")] });
  assert.deepEqual(one, two);
});

test("a single assistant is always the first responder", () => {
  assert.deepEqual(pickFirstResponder({ assignedToId: null, assistants: [assistant("a")] }), { kind: "assistant", id: "a", source: "queue" });
});

test("with no assistant able to receive the notice, the owner is the responder", () => {
  assert.deepEqual(pickFirstResponder({ assignedToId: null, assistants: [] }), { kind: "owner" });
  assert.deepEqual(
    pickFirstResponder({ assignedToId: null, assistants: [assistant("a", { active: false }), assistant("b", { whatsappNumber: "" })] }),
    { kind: "owner" }
  );
});

test("helpNotifyPlan tells the assistant first and the owner only when there is no assistant", () => {
  assert.deepEqual(helpNotifyPlan({ notify: true, responder: { kind: "assistant", id: "a", source: "queue" } }), { assistantId: "a", notifyOwner: false });
  assert.deepEqual(helpNotifyPlan({ notify: true, responder: { kind: "owner" } }), { assistantId: null, notifyOwner: true });
  assert.deepEqual(helpNotifyPlan({ notify: false, responder: { kind: "owner" } }), { assistantId: null, notifyOwner: false });
});

const OPEN = { assigneeNotifiedAt: minutesAgo(15), ownerNotifiedAt: null, takenAt: null };

test("escalation is due exactly when the assistant has been waiting the configured time", () => {
  assert.equal(escalationDue(NOW, { ...OPEN, assigneeNotifiedAt: minutesAgo(14) }, 15), false);
  assert.equal(escalationDue(NOW, { ...OPEN, assigneeNotifiedAt: minutesAgo(15) }, 15), true);
});

test("a request somebody took is never escalated", () => {
  assert.equal(escalationDue(NOW, { ...OPEN, takenAt: minutesAgo(1) }, 15), false);
});

test("the owner is told only once", () => {
  assert.equal(escalationDue(NOW, { ...OPEN, ownerNotifiedAt: minutesAgo(1) }, 15), false);
});

test("a request where no assistant was notified is not escalated (the owner already knows)", () => {
  assert.equal(escalationDue(NOW, { ...OPEN, assigneeNotifiedAt: null }, 15), false);
});

test("the minutes before the owner is told go from 15 to 240 in steps of 15", () => {
  for (const ok of [15, 30, 45, 60, 240]) assert.equal(isValidEscalationMinutes(ok), true, String(ok));
  for (const bad of [0, 10, 14, 16, 241, 255, -15, 22.5, Number.NaN]) assert.equal(isValidEscalationMinutes(bad), false, String(bad));
  assert.equal(isValidEscalationMinutes("30" as unknown as number), false);
});
