// Raising help on a chat, escalating to the owner, and detecting a customer who waits without an answer.
// The I/O (database, WhatsApp) is injected, so none of this needs a database.
import test from "node:test";
import assert from "node:assert/strict";
import {
  UNANSWERED_MINUTES,
  detectUnanswered,
  escalateDueChats,
  raiseHelpOnChat,
  type EscalationDeps,
  type HelpChatRow,
  type HelpDeps,
  type HelpTenant,
} from "../src/lib/help-requests";
import { helpNoticeText } from "../src/lib/help-notice";
import type { Assistant } from "../src/lib/help-routing";

const NOW = new Date("2026-11-18T16:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);
const TENANT: HelpTenant = { id: "t1", slug: "demo", customDomain: null, helpEscalationMinutes: 15 };

function chat(over: Partial<HelpChatRow> = {}): HelpChatRow {
  return {
    id: "c1",
    tenantId: "t1",
    helpReason: null,
    helpPriority: 0,
    helpRequestedAt: null,
    assignedToId: null,
    helpAssigneeNotifiedAt: null,
    helpOwnerNotifiedAt: null,
    helpTakenAt: null,
    ...over,
  };
}

function assistant(id: string, over: Partial<Assistant> = {}): Assistant {
  return { id, active: true, whatsappNumber: "+5215512345678", openCount: 0, lastNotifiedAt: null, ...over };
}

function fakeDeps(assistants: Assistant[], sends: { assistant?: boolean; owner?: boolean } = {}) {
  const saved: { id: string; data: Record<string, unknown> }[] = [];
  const toAssistant: { id: string; text: string }[] = [];
  const toOwner: string[] = [];
  const deps: HelpDeps = {
    loadAssistants: async () => assistants,
    saveChat: async (id, data) => {
      saved.push({ id, data });
    },
    sendToAssistant: async (_tenantId, id, text) => {
      toAssistant.push({ id, text });
      return sends.assistant ?? true;
    },
    sendToOwner: async (_tenantId, text) => {
      toOwner.push(text);
      return sends.owner ?? true;
    },
  };
  return { deps, saved, toAssistant, toOwner };
}

test("a new request goes to the assigned assistant, who is told and recorded as notified", async () => {
  const f = fakeDeps([assistant("a"), assistant("b")]);
  const out = await raiseHelpOnChat(f.deps, TENANT, chat({ assignedToId: "b" }), "person_requested", NOW);
  assert.deepEqual(out, { raised: true, notified: "assistant" });
  assert.equal(f.toAssistant.length, 1);
  assert.equal(f.toAssistant[0].id, "b");
  assert.equal(f.toOwner.length, 0);
  const data = f.saved[0].data;
  assert.equal(data.helpReason, "person_requested");
  assert.equal(data.helpPriority, 2);
  assert.deepEqual(data.helpRequestedAt, NOW);
  assert.deepEqual(data.helpAssigneeNotifiedAt, NOW);
});

test("with nobody assigned, the assistant that the queue picks is told and becomes the one in charge", async () => {
  const f = fakeDeps([assistant("a", { openCount: 2 }), assistant("b", { openCount: 0 })]);
  await raiseHelpOnChat(f.deps, TENANT, chat(), "purchase_intent", NOW);
  assert.equal(f.toAssistant[0].id, "b");
  assert.equal(f.saved[0].data.assignedToId, "b");
});

test("with no assistant able to receive the notice, the owner is told at once", async () => {
  const f = fakeDeps([]);
  const out = await raiseHelpOnChat(f.deps, TENANT, chat(), "send_failed", NOW);
  assert.deepEqual(out, { raised: true, notified: "owner" });
  assert.equal(f.toOwner.length, 1);
  assert.deepEqual(f.saved[0].data.helpOwnerNotifiedAt, NOW);
  assert.equal("helpAssigneeNotifiedAt" in f.saved[0].data, false);
});

test("if the assistant notice cannot be sent, the owner is told instead so the chat never goes unseen", async () => {
  const f = fakeDeps([assistant("a")], { assistant: false });
  const out = await raiseHelpOnChat(f.deps, TENANT, chat(), "person_requested", NOW);
  assert.deepEqual(out, { raised: true, notified: "owner" });
  assert.equal(f.toOwner.length, 1);
  assert.deepEqual(f.saved[0].data.helpOwnerNotifiedAt, NOW);
});

test("the state is saved even when no notice could be sent, so the chat still shows in the panel", async () => {
  const f = fakeDeps([], { owner: false });
  const out = await raiseHelpOnChat(f.deps, TENANT, chat(), "person_requested", NOW);
  assert.deepEqual(out, { raised: true, notified: null });
  assert.equal(f.saved[0].data.helpPriority, 2);
  assert.equal("helpOwnerNotifiedAt" in f.saved[0].data, false);
});

test("the same reason again changes nothing and tells nobody", async () => {
  const f = fakeDeps([assistant("a")]);
  const open = chat({ helpReason: "person_requested", helpPriority: 2, helpRequestedAt: minutesAgo(3), assignedToId: "a" });
  const out = await raiseHelpOnChat(f.deps, TENANT, open, "person_requested", NOW);
  assert.deepEqual(out, { raised: false, notified: null });
  assert.equal(f.saved.length, 0);
  assert.equal(f.toAssistant.length, 0);
});

test("a reason that goes up in priority tells the responder again and starts a new wait", async () => {
  const f = fakeDeps([assistant("a")]);
  const open = chat({ helpReason: "purchase_intent", helpPriority: 1, helpRequestedAt: minutesAgo(3), assignedToId: "a", helpOwnerNotifiedAt: minutesAgo(1) });
  const out = await raiseHelpOnChat(f.deps, TENANT, open, "person_requested", NOW);
  assert.equal(out.notified, "assistant");
  assert.equal(f.saved[0].data.helpOwnerNotifiedAt, null);
});

test("a request somebody already took is updated but nobody is told again", async () => {
  const f = fakeDeps([assistant("a")]);
  const taken = chat({ helpReason: "purchase_intent", helpPriority: 1, helpRequestedAt: minutesAgo(3), assignedToId: "a", helpTakenAt: minutesAgo(1) });
  const out = await raiseHelpOnChat(f.deps, TENANT, taken, "person_requested", NOW);
  assert.deepEqual(out, { raised: true, notified: null });
  assert.equal(f.toAssistant.length, 0);
  assert.equal(f.saved[0].data.helpPriority, 2);
});

test("a reason that is turned off does nothing", async () => {
  const f = fakeDeps([assistant("a")]);
  const out = await raiseHelpOnChat(f.deps, TENANT, chat(), "urgency", NOW);
  assert.deepEqual(out, { raised: false, notified: null });
  assert.equal(f.saved.length, 0);
});

test("the notice names the reason and links the chat in the panel, without any message content", () => {
  const text = helpNoticeText("person_requested", "https://demo.newaigent.com/admin/whatsapp?chat=c1", "assistant");
  assert.ok(text.includes("https://demo.newaigent.com/admin/whatsapp?chat=c1"));
  assert.ok(/persona/i.test(text));
  const escalation = helpNoticeText("purchase_intent", "https://x/y", "escalation");
  assert.ok(/nadie|sin atender|tiempo/i.test(escalation));
});

// Escalation to the owner
function escalationFakes(rows: { chat: HelpChatRow; tenant: HelpTenant }[], ownerSends = true) {
  const saved: { id: string; data: Record<string, unknown> }[] = [];
  const toOwner: string[] = [];
  const deps: EscalationDeps = {
    loadWaiting: async () => rows,
    saveChat: async (id, data) => {
      saved.push({ id, data });
    },
    sendToOwner: async (_tenantId, text) => {
      toOwner.push(text);
      return ownerSends;
    },
  };
  return { deps, saved, toOwner };
}

test("the owner is told once the assistant has waited the configured time", async () => {
  const waiting = chat({ helpReason: "person_requested", helpPriority: 2, helpAssigneeNotifiedAt: minutesAgo(15) });
  const f = escalationFakes([{ chat: waiting, tenant: TENANT }]);
  const result = await escalateDueChats(f.deps, NOW);
  assert.deepEqual(result, { checked: 1, escalated: 1, failed: 0 });
  assert.equal(f.toOwner.length, 1);
  assert.deepEqual(f.saved[0].data, { helpOwnerNotifiedAt: NOW });
});

test("a chat that has not waited long enough is left alone", async () => {
  const waiting = chat({ helpReason: "person_requested", helpPriority: 2, helpAssigneeNotifiedAt: minutesAgo(10) });
  const f = escalationFakes([{ chat: waiting, tenant: TENANT }]);
  const result = await escalateDueChats(f.deps, NOW);
  assert.deepEqual(result, { checked: 1, escalated: 0, failed: 0 });
});

test("the configured minutes of each business are used", async () => {
  const waiting = chat({ helpReason: "person_requested", helpPriority: 2, helpAssigneeNotifiedAt: minutesAgo(30) });
  const slow = { ...TENANT, helpEscalationMinutes: 60 };
  const f = escalationFakes([{ chat: waiting, tenant: slow }]);
  assert.equal((await escalateDueChats(f.deps, NOW)).escalated, 0);
});

test("a failed notice to the owner is counted and is not marked as sent, so the next run tries again", async () => {
  const waiting = chat({ helpReason: "person_requested", helpPriority: 2, helpAssigneeNotifiedAt: minutesAgo(20) });
  const f = escalationFakes([{ chat: waiting, tenant: TENANT }], false);
  const result = await escalateDueChats(f.deps, NOW);
  assert.deepEqual(result, { checked: 1, escalated: 0, failed: 1 });
  assert.equal(f.saved.length, 0);
});

// Unanswered customers
test("a customer who waits the limit without an answer opens an 'unanswered' request", async () => {
  assert.equal(UNANSWERED_MINUTES, 10);
  const f = fakeDeps([assistant("a")]);
  const result = await detectUnanswered(f.deps, { loadCandidates: async () => [{ chat: chat(), tenant: TENANT, lastInboundAt: minutesAgo(11) }] }, NOW);
  assert.deepEqual(result, { checked: 1, raised: 1 });
  assert.equal(f.saved[0].data.helpReason, "unanswered");
});

test("twice the limit makes it high priority", async () => {
  const f = fakeDeps([assistant("a")]);
  await detectUnanswered(f.deps, { loadCandidates: async () => [{ chat: chat(), tenant: TENANT, lastInboundAt: minutesAgo(25) }] }, NOW);
  assert.equal(f.saved[0].data.helpReason, "unanswered_long");
  assert.equal(f.saved[0].data.helpPriority, 2);
});

test("a customer who waited less than the limit is not flagged", async () => {
  const f = fakeDeps([assistant("a")]);
  const result = await detectUnanswered(f.deps, { loadCandidates: async () => [{ chat: chat(), tenant: TENANT, lastInboundAt: minutesAgo(5) }] }, NOW);
  assert.deepEqual(result, { checked: 1, raised: 0 });
  assert.equal(f.saved.length, 0);
});

test("a quiet request saves the state so the chat shows in the panel, but tells nobody", async () => {
  const f = fakeDeps([assistant("a")]);
  const out = await raiseHelpOnChat(f.deps, TENANT, chat(), "credits_exhausted", NOW, { quiet: true });
  assert.deepEqual(out, { raised: true, notified: null });
  assert.equal(f.toAssistant.length, 0);
  assert.equal(f.toOwner.length, 0);
  assert.equal(f.saved[0].data.helpReason, "credits_exhausted");
  assert.equal("helpAssigneeNotifiedAt" in f.saved[0].data, false);
});
