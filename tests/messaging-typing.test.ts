// tests/messaging-typing.test.ts
// The "typing" pause (Evolution delay) is only for the bot's replies. An owner's message from the panel must not
// wait 1.5 to 8 seconds before the answer comes back. Fake store and gateway, no network.
// Run: npx tsx --test tests/messaging-typing.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { sendOutbound, type Gateway, type GatewayContext, type OutboxStore, type SendTextOutcome } from "../src/lib/messaging/service";

const NOW = new Date("2026-11-20T15:00:00Z");

function fakeStore(): OutboxStore {
  return {
    async find() {
      return null;
    },
    async create(input) {
      return { id: "row-1", status: input.status, attempts: 0, maxAttempts: input.maxAttempts };
    },
    async update() {},
    async listHeld() {
      return [];
    },
  };
}

function recordingGateway() {
  const calls: Array<{ text: string; typing: boolean | undefined }> = [];
  const context: GatewayContext = {
    riskState: "NORMAL",
    killSwitch: { global: false, tenant: false, instance: false },
    optedOut: false,
    mode: "SHADOW",
    quietHours: false,
  };
  const gateway: Gateway = {
    async context() {
      return context;
    },
    async sendText(_tenantId, _to, text, options): Promise<SendTextOutcome> {
      calls.push({ text, typing: options?.typing });
      return { ok: true, messageId: "msg-1" };
    },
    async recordAttempt() {},
  };
  return { gateway, calls };
}

test("an owner's panel message is sent without the typing pause", async () => {
  const { gateway, calls } = recordingGateway();
  await sendOutbound(
    { tenantId: "t1", to: "5215550001111", purpose: "CUSTOMER_REPLY", text: "Hola, ya te contesto", idempotencyKey: "panel-1", consent: "NO" },
    { store: fakeStore(), gateway, now: () => NOW },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].typing, false);
});

test("a bot reply asks for the typing pause", async () => {
  const { gateway, calls } = recordingGateway();
  await sendOutbound(
    { tenantId: "t1", to: "5215550001111", purpose: "CUSTOMER_REPLY", text: "Claro, tenemos lugar a las 9:00", idempotencyKey: "bot-1", consent: "NO", typing: true },
    { store: fakeStore(), gateway, now: () => NOW },
  );
  assert.equal(calls[0].typing, true);
});
