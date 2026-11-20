// tests/messaging-service.test.ts
// Ban prevention: the send path with fake store and gateway (no database, no network).
// Run: npx tsx --test tests/messaging-service.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sendOutbound,
  type Gateway,
  type GatewayContext,
  type OutboundRequest,
  type OutboxRow,
  type OutboxStore,
  type SendTextOutcome,
} from "../src/lib/messaging/service";
import type { AttemptError, OutboxStatus } from "../src/lib/messaging/delivery";
import type { MessagePurpose } from "../src/lib/messaging/policy";
import { drainHeld } from "../src/lib/messaging/service";

const NOW = new Date("2026-11-20T15:00:00Z");

function fakeStore() {
  type Stored = OutboxRow & { key: string; tenantId: string; body: string | null; lastError: string | null; providerMessageId: string | null; recipient: string | null; scheduledAt: Date | null; purpose: MessagePurpose };
  const rows = new Map<string, Stored>();
  let seq = 0;
  const store: OutboxStore = {
    async find(tenantId, key) {
      const row = Array.from(rows.values()).find((r) => r.tenantId === tenantId && r.key === key);
      return row ? { id: row.id, status: row.status, attempts: row.attempts, maxAttempts: row.maxAttempts } : null;
    },
    async create(input) {
      const id = `row-${++seq}`;
      rows.set(id, {
        id,
        status: input.status,
        attempts: 0,
        maxAttempts: input.maxAttempts,
        key: input.idempotencyKey,
        tenantId: input.tenantId,
        body: input.body,
        lastError: null,
        providerMessageId: null,
        recipient: input.recipient,
        scheduledAt: input.scheduledAt,
        purpose: input.purpose,
      });
      return { id, status: input.status, attempts: 0, maxAttempts: input.maxAttempts };
    },
    async update(id, patch) {
      const row = rows.get(id);
      if (!row) throw new Error("no row " + id);
      Object.assign(row, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    },
    async listHeld(now, limit) {
      return Array.from(rows.values())
        .filter((r) => r.status === "QUEUED" && r.scheduledAt !== null && r.scheduledAt.getTime() <= now.getTime() && r.recipient && r.body)
        .slice(0, limit)
        .map((r) => ({ id: r.id, tenantId: r.tenantId, idempotencyKey: r.key, purpose: r.purpose, recipient: r.recipient as string, body: r.body as string }));
    },
  };
  return { store, rows };
}

function fakeGateway(opts: { context?: Partial<GatewayContext>; outcomes?: SendTextOutcome[] }) {
  const calls: string[] = [];
  const attempts: Array<{ ok: true } | { ok: false; error: AttemptError }> = [];
  const context: GatewayContext = {
    riskState: "NORMAL",
    killSwitch: { global: false, tenant: false, instance: false },
    optedOut: false,
    mode: "ENFORCE",
    quietHours: false,
    ...opts.context,
  };
  const queue = [...(opts.outcomes ?? [])];
  const gateway: Gateway = {
    async context() {
      return context;
    },
    async sendText(_tenant, to) {
      calls.push(to);
      const next = queue.shift();
      return next ?? { ok: true, messageId: `msg-${calls.length}` };
    },
    async recordAttempt(_tenant, outcome) {
      attempts.push(outcome);
    },
  };
  return { gateway, calls, attempts, context };
}

const base: OutboundRequest = {
  tenantId: "t1",
  to: "5215550000001",
  purpose: "TRANSACTIONAL",
  text: "Tu cita es mañana",
  idempotencyKey: "reminder:visit-1",
  consent: "YES",
};

test("a message with consent is sent once and its body is cleared after the send", async () => {
  const { store, rows } = fakeStore();
  const { gateway, calls, attempts } = fakeGateway({});
  const out = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(out.status, "SENT");
  assert.equal(calls.length, 1);
  assert.equal(Array.from(rows.values())[0].body, null);
  assert.deepEqual(attempts, [{ ok: true }]);
});

test("the same key after a successful send never reaches the provider again", async () => {
  const { store } = fakeStore();
  const { gateway, calls } = fakeGateway({});
  await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  const again = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(again.status, "SENT");
  assert.equal(again.duplicate, true);
  assert.equal(calls.length, 1);
});

test("a timeout after the request left is UNKNOWN, and the same key is never resent blindly", async () => {
  const { store } = fakeStore();
  const { gateway, calls } = fakeGateway({ outcomes: [{ ok: false, error: { kind: "timeout", requestLeft: true } }] });
  const first = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(first.status, "UNKNOWN");
  const second = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(second.status, "UNKNOWN");
  assert.equal(second.duplicate, true);
  assert.equal(calls.length, 1);
});

test("a network failure is retried on the next call until the attempts run out", async () => {
  const { store } = fakeStore();
  const net: SendTextOutcome = { ok: false, error: { kind: "network" } };
  const { gateway, calls } = fakeGateway({ outcomes: [net, net, net] });
  const req = { ...base, maxAttempts: 3 };
  for (let i = 0; i < 3; i++) {
    const out = await sendOutbound(req, { store, gateway, now: () => NOW });
    assert.equal(out.status, "FAILED");
  }
  const exhausted = await sendOutbound(req, { store, gateway, now: () => NOW });
  assert.equal(exhausted.status, "FAILED");
  assert.equal(exhausted.duplicate, true);
  assert.equal(calls.length, 3, "no fourth attempt once the cap is reached");
});

test("a missing setup does not use up an attempt: the message goes out once the setup is fixed", async () => {
  const { store } = fakeStore();
  const { gateway, calls } = fakeGateway({ outcomes: [{ ok: false, error: { kind: "unavailable" } }] });
  const first = await sendOutbound({ ...base, maxAttempts: 2 }, { store, gateway, now: () => NOW });
  assert.equal(first.status, "FAILED");
  const again = await sendOutbound({ ...base, maxAttempts: 2 }, { store, gateway, now: () => NOW });
  assert.equal(again.status, "SENT");
  assert.equal(again.duplicate, false);
  assert.equal(calls.length, 2);
});

test("a client error (4xx) is not retried", async () => {
  const { store } = fakeStore();
  const { gateway, calls } = fakeGateway({ outcomes: [{ ok: false, error: { kind: "client", status: 400 } }] });
  const out = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(out.status, "FAILED");
  const again = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(again.status, "FAILED");
  assert.equal(calls.length, 1);
});

test("a kill switch blocks the send, and the same key goes out once the switch is off", async () => {
  const { store } = fakeStore();
  const { gateway, calls, context } = fakeGateway({ context: { killSwitch: { global: true, tenant: false, instance: false } } });
  const blocked = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(calls.length, 0);
  context.killSwitch = { global: false, tenant: false, instance: false };
  const later = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(later.status, "SENT");
  assert.equal(calls.length, 1);
});

test("an opted-out recipient is never messaged", async () => {
  const { store } = fakeStore();
  const { gateway, calls } = fakeGateway({ context: { optedOut: true } });
  const out = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(out.status, "BLOCKED");
  assert.equal(calls.length, 0);
});

test("without consent, SHADOW measures and still sends; ENFORCE blocks", async () => {
  const shadow = fakeStore();
  const shadowGw = fakeGateway({ context: { mode: "SHADOW" } });
  const sent = await sendOutbound({ ...base, consent: "NO" }, { store: shadow.store, gateway: shadowGw.gateway, now: () => NOW });
  assert.equal(sent.status, "SENT");

  const enforce = fakeStore();
  const enforceGw = fakeGateway({ context: { mode: "ENFORCE" } });
  const blocked = await sendOutbound({ ...base, consent: "NO", idempotencyKey: "reminder:visit-2" }, { store: enforce.store, gateway: enforceGw.gateway, now: () => NOW });
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(enforceGw.calls.length, 0);
});

test("quiet hours hold a non-urgent message and send it later under the same key", async () => {
  const { store } = fakeStore();
  const { gateway, calls, context } = fakeGateway({ context: { quietHours: true } });
  const held = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(held.status, "QUEUED");
  assert.equal(calls.length, 0);
  context.quietHours = false;
  const later = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(later.status, "SENT");
  assert.equal(calls.length, 1);
});

test("an urgent message is not held for quiet hours", async () => {
  const { store } = fakeStore();
  const { gateway, calls } = fakeGateway({ context: { quietHours: true } });
  const out = await sendOutbound({ ...base, urgent: true }, { store, gateway, now: () => NOW });
  assert.equal(out.status, "SENT");
  assert.equal(calls.length, 1);
});

test("an internal notice goes to the business's own number without customer consent", async () => {
  const { store } = fakeStore();
  const { gateway, calls } = fakeGateway({ context: { mode: "ENFORCE" } });
  const out = await sendOutbound(
    { ...base, purpose: "INTERNAL", consent: "NO", recipientIsTeam: true, idempotencyKey: "owner:alert-1" },
    { store, gateway, now: () => NOW },
  );
  assert.equal(out.status, "SENT");
  assert.equal(calls.length, 1);
});

test("an auth error is reported to the breaker and the message is not retried", async () => {
  const { store } = fakeStore();
  const { gateway, attempts } = fakeGateway({ outcomes: [{ ok: false, error: { kind: "auth", status: 401 } }] });
  const out = await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(out.status, "FAILED");
  assert.deepEqual(attempts, [{ ok: false, error: { kind: "auth", status: 401 } }]);
});

test("the outbox receives only the last four digits of the recipient, never the full number", async () => {
  const { store } = fakeStore();
  const received: string[] = [];
  const spy: OutboxStore = {
    find: store.find,
    update: store.update,
    listHeld: store.listHeld,
    async create(input) {
      received.push(input.recipientKey);
      return store.create(input);
    },
  };
  const { gateway } = fakeGateway({ context: { quietHours: true } });
  await sendOutbound({ ...base }, { store: spy, gateway, now: () => NOW });
  assert.deepEqual(received, ["***0001"]);
  assert.ok(!received[0].includes("5215550000001"));
});

test("a shadow-blocked message is still sent, and the outbox records the decision", async () => {
  const { store, rows } = fakeStore();
  const { gateway } = fakeGateway({ context: { mode: "SHADOW" } });
  await sendOutbound({ ...base, consent: "NO" }, { store, gateway, now: () => NOW });
  const row = Array.from(rows.values())[0];
  assert.equal(row.status as OutboxStatus, "SENT");
});

test("a held message is sent once the quiet hours end, with the same key and the stored text", async () => {
  const { store } = fakeStore();
  const { gateway, calls, context } = fakeGateway({ context: { quietHours: true } });
  await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(calls.length, 0);
  context.quietHours = false;
  const drained = await drainHeld({ store, gateway, now: () => NOW });
  assert.deepEqual(drained, { checked: 1, sent: 1, held: 0, failed: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0], base.to);
});

test("a second drain never sends a held message twice", async () => {
  const { store } = fakeStore();
  const { gateway, calls, context } = fakeGateway({ context: { quietHours: true } });
  await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  context.quietHours = false;
  await drainHeld({ store, gateway, now: () => NOW });
  const again = await drainHeld({ store, gateway, now: () => NOW });
  assert.equal(again.checked, 0);
  assert.equal(calls.length, 1);
});

test("a message still in quiet hours stays held when drained", async () => {
  const { store } = fakeStore();
  const { gateway, calls } = fakeGateway({ context: { quietHours: true } });
  await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  const drained = await drainHeld({ store, gateway, now: () => NOW });
  assert.deepEqual(drained, { checked: 1, sent: 0, held: 1, failed: 0 });
  assert.equal(calls.length, 0);
});

test("a kill switch turned on while a message is held stops it from going out", async () => {
  const { store } = fakeStore();
  const { gateway, calls, context } = fakeGateway({ context: { quietHours: true } });
  await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  context.quietHours = false;
  context.killSwitch = { global: true, tenant: false, instance: false };
  const drained = await drainHeld({ store, gateway, now: () => NOW });
  assert.equal(drained.sent, 0);
  assert.equal(calls.length, 0);
});

test("a sent message keeps no recipient and no text in the outbox", async () => {
  const { store, rows } = fakeStore();
  const { gateway } = fakeGateway({ context: { quietHours: true } });
  await sendOutbound({ ...base }, { store, gateway, now: () => NOW });
  assert.equal(Array.from(rows.values())[0].recipient, base.to);
  gateway.context = async () => ({ riskState: "NORMAL", killSwitch: { global: false, tenant: false, instance: false }, optedOut: false, mode: "ENFORCE", quietHours: false });
  await drainHeld({ store, gateway, now: () => NOW });
  const row = Array.from(rows.values())[0];
  assert.equal(row.status, "SENT");
  assert.equal(row.recipient, null);
  assert.equal(row.body, null);
});
