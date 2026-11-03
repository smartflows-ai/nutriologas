// Regression for ticket #16: the reminder run must not stop on one bad visit, and a failed send must be reported.
// Run: npx tsx --test local-utils/reminder-run.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { reminderRunStatus, runReminderBatch, type ReminderBatchResult, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-02T18:00:00.000Z");

function visit(overrides: Partial<ReminderVisit> = {}): ReminderVisit {
  return {
    id: "a1",
    tenantId: "t1",
    customerPhone: "525500000001",
    appointmentDate: new Date(NOW.getTime() + 23 * HOUR), // reminder (24 h before) was due 1 h ago
    createdAt: new Date(NOW.getTime() - 48 * HOUR),
    reminderSentAt: null,
    reminderAttempts: 0,
    customerConfirmedAt: null,
    autoReleasedAt: null,
    externalProvider: null,
    externalEventId: null,
    productName: "Consulta",
    tenant: {
      name: "Clinica",
      messageLanguage: "es",
      reminderLeadMinutes: 24 * 60,
      confirmationRequired: true,
      confirmationDeadlineMinutes: 120,
      reminderTemplate: null,
      confirmationTemplate: null,
      cancellationTemplate: null,
    },
    ...overrides,
  };
}

/** A visit whose confirmation deadline already passed without an answer. */
function overdue(id: string): ReminderVisit {
  return visit({
    id,
    appointmentDate: new Date(NOW.getTime() + 1 * HOUR),
    reminderSentAt: new Date(NOW.getTime() - 20 * HOUR),
  });
}

function fakeDeps(overrides: Partial<ReminderDeps> = {}) {
  const calls = {
    sent: [] as string[],
    marked: [] as string[],
    charged: [] as string[],
    released: [] as string[],
    failed: [] as { id: string; reason: string; now: Date }[],
  };
  const deps: ReminderDeps = {
    send: async (v) => {
      calls.sent.push(v.id);
      return { success: true };
    },
    markSent: async (id) => void calls.marked.push(id),
    recordFailure: async (v, reason, now) => void calls.failed.push({ id: v.id, reason, now }),
    charge: async (tenantId) => void calls.charged.push(tenantId),
    release: async (v) => {
      calls.released.push(v.id);
      return { customerNotified: true };
    },
    ...overrides,
  };
  return { deps, calls };
}

test("sends a due reminder, marks it and charges once", async () => {
  const { deps, calls } = fakeDeps();
  const result = await runReminderBatch([visit()], NOW, deps, { dryRun: false });
  assert.equal(result.sent, 1);
  assert.deepEqual(calls.marked, ["a1"]);
  assert.deepEqual(calls.charged, ["t1"]);
  assert.equal(result.failures.length, 0);
});

test("a visit without phone is skipped, never sent", async () => {
  const { deps, calls } = fakeDeps();
  const result = await runReminderBatch([visit({ customerPhone: null })], NOW, deps, { dryRun: false });
  assert.equal(result.skipped, 1);
  assert.equal(calls.sent.length, 0);
});

test("a failed send is reported with its reason and is neither marked nor charged", async () => {
  const { deps, calls } = fakeDeps({ send: async () => ({ success: false, reason: "WhatsApp no esta conectado" }) });
  const result = await runReminderBatch([visit()], NOW, deps, { dryRun: false });
  assert.equal(result.failed, 1);
  assert.equal(calls.marked.length, 0);
  assert.equal(calls.charged.length, 0);
  assert.deepEqual(result.failures, [{ appointmentId: "a1", tenantId: "t1", kind: "send_failed", reason: "WhatsApp no esta conectado" }]);
});

test("an exception on one visit does not stop the visits after it", async () => {
  const { deps, calls } = fakeDeps({
    release: async (v) => {
      if (v.id === "boom") throw new Error("database timeout");
      return { customerNotified: true };
    },
  });
  const result = await runReminderBatch([overdue("boom"), visit({ id: "next" })], NOW, deps, { dryRun: false });
  assert.deepEqual(calls.marked, ["next"], "the second visit still gets its reminder");
  assert.equal(result.sent, 1);
  assert.equal(result.failures[0].appointmentId, "boom");
  assert.equal(result.failures[0].kind, "exception");
  assert.match(result.failures[0].reason, /database timeout/);
});

test("a release whose cancellation text was not delivered is reported", async () => {
  const { deps } = fakeDeps({ release: async () => ({ customerNotified: false }) });
  const result = await runReminderBatch([overdue("r1")], NOW, deps, { dryRun: false });
  assert.equal(result.released, 1, "the visit is still released");
  assert.equal(result.failures[0].kind, "cancellation_not_sent");
});

test("dry run lists the work and touches nothing", async () => {
  const { deps, calls } = fakeDeps();
  const result = await runReminderBatch([visit(), overdue("r1")], NOW, deps, { dryRun: true });
  assert.equal(result.actions.length, 2);
  assert.equal(calls.sent.length + calls.marked.length + calls.charged.length + calls.released.length, 0);
});

function batch(overrides: Partial<ReminderBatchResult>): ReminderBatchResult {
  return { sent: 0, released: 0, skipped: 0, failed: 0, failures: [], actions: [], ...overrides };
}

test("HTTP status is 502 when every attempted send failed", () => {
  assert.equal(reminderRunStatus(batch({ sent: 0, failed: 2 }), false), 502);
});

test("HTTP status is 200 when at least one send worked, even if another failed", () => {
  assert.equal(reminderRunStatus(batch({ sent: 1, failed: 1 }), false), 200);
});

test("HTTP status is 200 when nothing was attempted", () => {
  assert.equal(reminderRunStatus(batch({}), false), 200);
});

test("HTTP status is 200 on a dry run, whatever the counts", () => {
  assert.equal(reminderRunStatus(batch({ sent: 0, failed: 3 }), true), 200);
});

test("a failed send is recorded on the visit with its reason and the run time", async () => {
  const { deps, calls } = fakeDeps({ send: async () => ({ success: false, reason: "instancia desconectada" }) });
  await runReminderBatch([visit()], NOW, deps, { dryRun: false });
  assert.deepEqual(calls.failed, [{ id: "a1", reason: "instancia desconectada", now: NOW }]);
});

test("a successful send records no failure", async () => {
  const { deps, calls } = fakeDeps();
  await runReminderBatch([visit()], NOW, deps, { dryRun: false });
  assert.equal(calls.failed.length, 0);
});

test("a dry run records no failure", async () => {
  const { deps, calls } = fakeDeps({ send: async () => ({ success: false, reason: "x" }) });
  await runReminderBatch([visit()], NOW, deps, { dryRun: true });
  assert.equal(calls.failed.length, 0);
});

test("if recording the failure itself breaks, the send failure is still reported and the run continues", async () => {
  const { deps, calls } = fakeDeps({
    send: async (v) => (v.id === "bad" ? { success: false, reason: "rechazado" } : { success: true }),
    recordFailure: async () => {
      throw new Error("db down");
    },
  });
  const result = await runReminderBatch([visit({ id: "bad" }), visit({ id: "good" })], NOW, deps, { dryRun: false });
  assert.equal(result.failures[0].kind, "send_failed");
  assert.equal(result.failures[0].reason, "rechazado");
  assert.deepEqual(calls.marked, ["good"]);
});

test("a visit the customer confirmed is never released, even after the deadline", async () => {
  const { deps, calls } = fakeDeps();
  const confirmed = { ...overdue("c1"), customerConfirmedAt: new Date(NOW.getTime() - 30 * 60 * 1000) };
  const result = await runReminderBatch([confirmed], NOW, deps, { dryRun: false });
  assert.equal(result.released, 0);
  assert.deepEqual(calls.released, []);
  assert.equal(result.failures.length, 0);
});
