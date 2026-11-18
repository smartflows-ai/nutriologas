// The owner puts an assistant in charge of a chat that needs help: the in-app notice, the WhatsApp reminder that follows,
// the owner told when the assistant cannot receive it, and the assistant who is never replaced in silence.
import test from "node:test";
import assert from "node:assert/strict";
import { assignmentReminderDue, ASSIGNMENT_REMINDER_MINUTES, type AssignmentState, type Assistant } from "../src/lib/help-routing";
import { assignmentKey, contactLabel, newAssignments, type AssignmentView } from "../src/lib/help-view";
import { helpNoticeText } from "../src/lib/help-notice";
import { raiseHelpOnChat, remindAssignees, type AssignmentDeps, type HelpChatRow, type HelpDeps, type HelpTenant } from "../src/lib/help-requests";

const NOW = new Date("2026-11-18T16:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);
const TENANT: HelpTenant = { id: "t1", slug: "demo", customDomain: null, helpEscalationMinutes: 15 };

const base: AssignmentState = {
  assignedToId: "ana",
  helpPriority: 2,
  helpAssignedAt: minutesAgo(15),
  takenAt: null,
  assigneeNotifiedAt: null,
  ownerNotifiedAt: null,
};

test("the WhatsApp reminder waits one job run after the assignment (15 minutes)", () => {
  assert.equal(ASSIGNMENT_REMINDER_MINUTES, 15);
  assert.equal(assignmentReminderDue(NOW, base), true);
  assert.equal(assignmentReminderDue(NOW, { ...base, helpAssignedAt: minutesAgo(14) }), false);
});

test("no reminder when nobody is in charge, the chat needs no help, or it was taken", () => {
  assert.equal(assignmentReminderDue(NOW, { ...base, assignedToId: null }), false);
  assert.equal(assignmentReminderDue(NOW, { ...base, helpPriority: 0 }), false);
  assert.equal(assignmentReminderDue(NOW, { ...base, takenAt: minutesAgo(1) }), false);
});

test("an assistant already reminded about this assignment is not reminded again", () => {
  assert.equal(assignmentReminderDue(NOW, { ...base, assigneeNotifiedAt: minutesAgo(5) }), false, "told after the assignment");
  assert.equal(assignmentReminderDue(NOW, { ...base, assigneeNotifiedAt: minutesAgo(30) }), true, "told before a newer assignment");
});

test("the owner told already: the reminder stops (the escalation carries on from there)", () => {
  assert.equal(assignmentReminderDue(NOW, { ...base, ownerNotifiedAt: minutesAgo(1) }), false);
});

test("a new notice is one that the person has not seen yet and that is less than a day old", () => {
  const fresh: AssignmentView = { id: "c1", contact: "Ana", reason: "purchase_intent", priority: 1, assignedAt: minutesAgo(2).toISOString() };
  const old: AssignmentView = { id: "c2", contact: "Luis", reason: null, priority: 0, assignedAt: minutesAgo(60 * 25).toISOString() };
  const seen = new Set([assignmentKey(fresh)]);
  assert.deepEqual(newAssignments([fresh, old], new Set(), NOW), [fresh]);
  assert.deepEqual(newAssignments([fresh], seen, NOW), [], "seen once, not again");
  const again: AssignmentView = { ...fresh, assignedAt: minutesAgo(1).toISOString() };
  assert.deepEqual(newAssignments([again], seen, NOW), [again], "assigned again is a new notice");
});

test("a chat is named by the WhatsApp name, or by the last digits of the number", () => {
  assert.equal(contactLabel("  Ana Pérez ", "5215500000101@s.whatsapp.net"), "Ana Pérez");
  assert.equal(contactLabel(null, "5215500000101@s.whatsapp.net"), "···0101");
  assert.equal(contactLabel("", "12@s.whatsapp.net"), "···");
});

test("the WhatsApp texts for assignments never carry the customer's message or name", () => {
  const url = "https://demo.newaigent.com/admin/whatsapp?chat=c1";
  const assigned = helpNoticeText("person_requested", url, "assignment");
  assert.ok(assigned.startsWith("Te asignaron un chat"));
  assert.ok(assigned.includes(url));
  const unreachable = helpNoticeText("purchase_intent", url, "owner_unreachable");
  assert.ok(/no se pudo avisar por WhatsApp/i.test(unreachable));
  assert.ok(unreachable.includes(url));
});

// The flow with injected I/O
function assistant(id: string, over: Partial<Assistant> = {}): Assistant {
  return { id, active: true, whatsappNumber: "+5215512345678", openCount: 0, lastNotifiedAt: null, ...over };
}
function chat(over: Partial<HelpChatRow> = {}): HelpChatRow {
  return {
    id: "c1", tenantId: "t1", helpReason: "purchase_intent", helpPriority: 1, helpRequestedAt: minutesAgo(3),
    assignedToId: null, helpAssigneeNotifiedAt: null, helpOwnerNotifiedAt: null, helpTakenAt: null, helpAssignedAt: null, ...over,
  };
}
function raiseFakes(assistants: Assistant[], sends: { assistant?: boolean; owner?: boolean } = {}) {
  const saved: { id: string; data: Record<string, unknown> }[] = [];
  const toAssistant: { id: string; text: string }[] = [];
  const toOwner: string[] = [];
  const deps: HelpDeps = {
    loadAssistants: async () => assistants,
    saveChat: async (id, data) => {
      saved.push({ id, data });
    },
    sendToAssistant: async (_t, id, text) => {
      toAssistant.push({ id, text });
      return sends.assistant ?? true;
    },
    sendToOwner: async (_t, text) => {
      toOwner.push(text);
      return sends.owner ?? true;
    },
  };
  return { deps, saved, toAssistant, toOwner };
}

test("a chat in charge of an assistant without a number is not taken over in silence: the owner is told and the assignee stays", async () => {
  const f = raiseFakes([assistant("x", { whatsappNumber: null }), assistant("y")]);
  const out = await raiseHelpOnChat(f.deps, TENANT, chat({ assignedToId: "x" }), "person_requested", NOW);
  assert.deepEqual(out, { raised: true, notified: "owner" });
  assert.equal(f.toAssistant.length, 0, "the queue member is not told behind the owner's choice");
  assert.equal(f.toOwner.length, 1);
  assert.ok(/No se pudo avisar por WhatsApp/.test(f.toOwner[0]), "the owner is told the assistant cannot be reached");
  assert.equal("assignedToId" in f.saved[0].data, false, "the assignment is not rewritten");
});

test("an unassigned chat still gets the queue's pick, who becomes the one in charge", async () => {
  const f = raiseFakes([assistant("x", { openCount: 2 }), assistant("y", { openCount: 0 })]);
  await raiseHelpOnChat(f.deps, TENANT, chat({ assignedToId: null }), "person_requested", NOW);
  assert.equal(f.toAssistant[0].id, "y");
  assert.equal(f.saved[0].data.assignedToId, "y");
});

function reminderFakes(rows: { chat: HelpChatRow; tenant?: HelpTenant }[], sends: { assistant?: boolean; owner?: boolean } = {}) {
  const saved: { id: string; data: Record<string, unknown> }[] = [];
  const toAssistant: { id: string; text: string }[] = [];
  const toOwner: string[] = [];
  const deps: AssignmentDeps = {
    loadPending: async () => rows.map((r) => ({ chat: r.chat, tenant: r.tenant ?? TENANT })),
    saveChat: async (id, data) => {
      saved.push({ id, data });
    },
    sendToAssistant: async (_t, id, text) => {
      toAssistant.push({ id, text });
      return sends.assistant ?? true;
    },
    sendToOwner: async (_t, text) => {
      toOwner.push(text);
      return sends.owner ?? true;
    },
  };
  return { deps, saved, toAssistant, toOwner };
}

test("after the wait, the assistant gets the WhatsApp reminder and it is recorded", async () => {
  const pending = chat({ assignedToId: "ana", helpAssignedAt: minutesAgo(16) });
  const f = reminderFakes([{ chat: pending }]);
  const result = await remindAssignees(f.deps, NOW);
  assert.deepEqual(result, { checked: 1, reminded: 1, ownerTold: 0 });
  assert.equal(f.toAssistant[0].id, "ana");
  assert.deepEqual(f.saved[0].data, { helpAssigneeNotifiedAt: NOW });
});

test("the assistant cannot receive the reminder: the owner is told once and the chat is marked", async () => {
  const pending = chat({ assignedToId: "ana", helpAssignedAt: minutesAgo(16) });
  const f = reminderFakes([{ chat: pending }], { assistant: false });
  const result = await remindAssignees(f.deps, NOW);
  assert.deepEqual(result, { checked: 1, reminded: 0, ownerTold: 1 });
  assert.deepEqual(f.saved[0].data, { helpOwnerNotifiedAt: NOW });
});

test("a failed owner notice is not marked, so the next run tries again", async () => {
  const pending = chat({ assignedToId: "ana", helpAssignedAt: minutesAgo(16) });
  const f = reminderFakes([{ chat: pending }], { assistant: false, owner: false });
  const result = await remindAssignees(f.deps, NOW);
  assert.deepEqual(result, { checked: 1, reminded: 0, ownerTold: 0 });
  assert.equal(f.saved.length, 0);
});

test("a chat assigned less than 15 minutes ago is left alone", async () => {
  const f = reminderFakes([{ chat: chat({ assignedToId: "ana", helpAssignedAt: minutesAgo(5) }) }]);
  assert.deepEqual(await remindAssignees(f.deps, NOW), { checked: 1, reminded: 0, ownerTold: 0 });
  assert.equal(f.toAssistant.length, 0);
});

// The customer wrote again while nobody took the chat
import { customerWroteAgain } from "../src/lib/help-view";
import { resolvePatch } from "../src/lib/help-actions";

test("the 'wrote again' mark shows only while a request is open and nobody has taken the chat", () => {
  const wrote = minutesAgo(2).toISOString();
  assert.equal(customerWroteAgain({ helpPriority: 2, helpTakenAt: null, helpCustomerWroteAt: wrote }), true);
  assert.equal(customerWroteAgain({ helpPriority: 2, helpTakenAt: minutesAgo(1).toISOString(), helpCustomerWroteAt: wrote }), false, "taken");
  assert.equal(customerWroteAgain({ helpPriority: 0, helpTakenAt: null, helpCustomerWroteAt: wrote }), false, "no request");
  assert.equal(customerWroteAgain({ helpPriority: 2, helpTakenAt: null, helpCustomerWroteAt: null }), false, "nothing written");
});

test("marking the chat handled clears the 'wrote again' mark", () => {
  assert.equal(resolvePatch().helpCustomerWroteAt, null);
});

test("every notice to an assistant also sets the time the toast is keyed by (not only the owner's assignments)", async () => {
  const assignedRaise = raiseFakes([assistant("y")]);
  await raiseHelpOnChat(assignedRaise.deps, TENANT, chat({ assignedToId: "y" }), "person_requested", NOW);
  assert.deepEqual(assignedRaise.saved[0].data.helpAssignedAt, NOW, "assigned assistant: toast");

  const queuePick = raiseFakes([assistant("x", { openCount: 2 }), assistant("y", { openCount: 0 })]);
  await raiseHelpOnChat(queuePick.deps, TENANT, chat({ assignedToId: null }), "person_requested", NOW);
  assert.equal(queuePick.saved[0].data.assignedToId, "y");
  assert.deepEqual(queuePick.saved[0].data.helpAssignedAt, NOW, "queue pick: toast");
});

test("the WhatsApp reminder does not repeat right after a notice that set the same time", () => {
  const notified = { assignedToId: "y", helpPriority: 2, helpAssignedAt: NOW, takenAt: null, assigneeNotifiedAt: NOW, ownerNotifiedAt: null };
  assert.equal(assignmentReminderDue(new Date(NOW.getTime() + 20 * 60 * 1000), notified), false);
});

test("the owner notice for a chat no assistant could take is its own notice, separate from an assignment", () => {
  const assigned: AssignmentView = { id: "c9", contact: "Ana", reason: "person_requested", priority: 2, assignedAt: minutesAgo(3).toISOString() };
  const unattended: AssignmentView = { ...assigned, kind: "unattended", assignedAt: minutesAgo(1).toISOString() };
  assert.notEqual(assignmentKey(assigned), assignmentKey(unattended));
  assert.deepEqual(newAssignments([unattended], new Set([assignmentKey(assigned)]), NOW), [unattended], "not hidden by an earlier assignment");
});
