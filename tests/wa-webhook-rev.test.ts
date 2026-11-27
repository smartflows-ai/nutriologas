// tests/wa-webhook-rev.test.ts
// Ticket #182 / #154 (plan v11): the WhatsApp webhook stops carrying the file (base64 false) only for the businesses
// that are on, and the app applies it by itself in the 15-minute round, once per line, with no disconnect and no QR.
// A business taken off the list gets the usual webhook back. Everything is injected: no network, no database.
// Run with: npx tsx --test tests/wa-webhook-rev.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  WEBHOOK_BASE64_META,
  WEBHOOK_SLOT_MS,
  decideWebhook,
  reconcileWebhooks,
  storedBase64Of,
  type WebhookDeps,
  type WebhookLine,
} from "../src/lib/wa-webhook-rev";
import { RUN_DEADLINE_MS, type RunClock } from "../src/lib/wa-media-purge";
import { createInstance, setWebhook, type EvolutionConfig } from "../src/lib/messaging/evolution-adapter";

const ON = "0b6f1a52-6a7e-4f43-9d55-1c1f0e7a9a11";
const OFF = "7d2c9e10-3b4a-4c5d-8e6f-a1b2c3d4e5f6";
const FRESH: RunClock = { elapsedMs: () => 0 };

const READY = { connected: true, hasConfig: true, hasUrl: true, hasSecret: true };

// ── The rule ────────────────────────────────────────────────────────────────

test("a business that is on and has no mark gets the webhook without the file", () => {
  assert.deepEqual(decideWebhook({ enabled: true, stored: null, ...READY }), { action: "apply", base64: false });
});

test("a line already applied is left alone: one call per line, only once", () => {
  assert.deepEqual(decideWebhook({ enabled: true, stored: false, ...READY }), { action: "skip", reason: "up_to_date" });
});

test("a business that is off and has no mark is never called (today's lines keep the usual webhook)", () => {
  assert.deepEqual(decideWebhook({ enabled: false, stored: null, ...READY }), { action: "skip", reason: "up_to_date" });
  assert.deepEqual(decideWebhook({ enabled: false, stored: true, ...READY }), { action: "skip", reason: "up_to_date" });
});

test("a business taken off the list gets the usual webhook back", () => {
  assert.deepEqual(decideWebhook({ enabled: false, stored: false, ...READY }), { action: "apply", base64: true });
});

test("without a connected line, the connection, the stored address or the secret, it is skipped with a short code", () => {
  const cases = [
    [{ connected: false }, "line_not_connected"],
    [{ hasConfig: false }, "no_connection_config"],
    [{ hasUrl: false }, "no_webhook_url"],
    [{ hasSecret: false }, "no_secret"],
  ] as const;
  for (const [missing, reason] of cases) {
    assert.deepEqual(decideWebhook({ enabled: true, stored: null, ...READY, ...missing }), { action: "skip", reason }, reason);
  }
});

test("the mark is read from the line's metadata; anything that is not a boolean is no mark", () => {
  assert.equal(storedBase64Of({ [WEBHOOK_BASE64_META]: false, instanceName: "x" }), false);
  assert.equal(storedBase64Of({ [WEBHOOK_BASE64_META]: true }), true);
  for (const metadata of [null, undefined, "x", [], {}, { [WEBHOOK_BASE64_META]: "false" }]) {
    assert.equal(storedBase64Of(metadata), null);
  }
});

// ── The round ───────────────────────────────────────────────────────────────

function line(tenantId: string, overrides: Partial<WebhookLine> = {}): WebhookLine {
  return {
    tenantId,
    instance: `slug-${tenantId}`,
    apiKey: `KEY-${tenantId.slice(0, 4)}`,
    webhookUrl: `https://hooks.example/slug-${tenantId}`,
    connected: true,
    stored: null,
    metadata: { instanceName: `slug-${tenantId}` },
    ...overrides,
  };
}

function world(
  options: { lines?: WebhookLine[]; setFails?: boolean; secret?: string | null; hasConfig?: boolean; states?: Array<"open" | "connecting" | "close" | null> } = {},
) {
  const states = [...(options.states ?? [])];
  const calls: string[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const deps: WebhookDeps = {
    async listLines() {
      return options.lines ?? [line(ON), line(OFF)];
    },
    enabledFor: (tenantId) => tenantId === ON,
    hasConfig: options.hasConfig ?? true,
    secret: options.secret === undefined ? "S3CRET" : options.secret,
    async stateOf(l) {
      calls.push(`state:${l.instance}`);
      return states.length > 0 ? (states.shift() ?? null) : "open";
    },
    async setWebhook(l, base64, headers) {
      calls.push(`set:${l.instance}:${l.apiKey}:${l.webhookUrl}:${base64}:${JSON.stringify(headers)}`);
      return !options.setFails;
    },
    async markApplied(l, base64) {
      calls.push(`mark:${l.tenantId}:${base64}`);
    },
    log(event) {
      logs.push(event);
    },
  };
  return { deps, calls, logs };
}

test("only the line of the business that is on is applied, with its own key, its stored address and the signed headers", async () => {
  const { deps, calls } = world();
  const result = await reconcileWebhooks(deps, FRESH);
  assert.equal(result.applied, 1);
  assert.ok(calls.includes(`set:slug-${ON}:KEY-${ON.slice(0, 4)}:https://hooks.example/slug-${ON}:false:{"jwt_key":"S3CRET"}`));
  assert.ok(!calls.some((c) => c.startsWith(`set:slug-${OFF}`)), "the business that is off is not called");
  assert.ok(calls.includes(`mark:${ON}:false`));
});

test("the state of the line is read before and after applying, as the measurement of the first time", async () => {
  const { deps, calls, logs } = world({ lines: [line(ON)] });
  await reconcileWebhooks(deps, FRESH);
  assert.deepEqual(calls, [`state:slug-${ON}`, calls[1], `state:slug-${ON}`, `mark:${ON}:false`]);
  assert.deepEqual(logs, [{ tenantId: ON, base64: false, applied: true, stateBefore: "open", stateAfter: "open" }]);
});

test("without the secret nothing is sent (the webhook is never set without its headers) and nothing is marked", async () => {
  const { deps, calls } = world({ secret: null });
  const result = await reconcileWebhooks(deps, FRESH);
  assert.equal(result.applied, 0);
  assert.equal(result.skipped.no_secret, 1);
  assert.ok(!calls.some((c) => c.startsWith("set:") || c.startsWith("mark:")));
});

test("a failed call marks nothing, so the next round tries again", async () => {
  const { deps, calls } = world({ setFails: true });
  const result = await reconcileWebhooks(deps, FRESH);
  assert.equal(result.failed, 1);
  assert.ok(!calls.some((c) => c.startsWith("mark:")));
});

test("a line that does not fit in the run's time is not called and waits for the next round", async () => {
  const late: RunClock = { elapsedMs: () => RUN_DEADLINE_MS - WEBHOOK_SLOT_MS + 1 };
  const { deps, calls } = world();
  const result = await reconcileWebhooks(deps, late);
  assert.equal(result.leftForNextRun, 1);
  assert.deepEqual(calls, []);
});

test("lines already up to date cost nothing: no state read, no call", async () => {
  const { deps, calls } = world({ lines: [line(ON, { stored: false }), line(OFF)] });
  const result = await reconcileWebhooks(deps, FRESH);
  assert.deepEqual(calls, []);
  assert.equal(result.skipped.up_to_date, 2);
});

// ── The connection's webhook body ───────────────────────────────────────────

function capture() {
  const bodies: Array<Record<string, unknown>> = [];
  const impl = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ hash: "T" }), { status: 201 });
  }) as unknown as typeof fetch;
  const cfg: EvolutionConfig = { baseUrl: "https://evo.example.com", globalKey: "G", timeoutMs: 1000, fetchImpl: impl };
  return { cfg, bodies };
}

test("the webhook body says explicitly whether the file travels, for a new line and for an existing one", async () => {
  for (const base64 of [true, false]) {
    const { cfg, bodies } = capture();
    await createInstance(cfg, { instance: "i", webhookUrl: "https://h/w", headers: { jwt_key: "S" }, base64 });
    await setWebhook(cfg, { instance: "i", apiKey: "K", url: "https://h/w", headers: { jwt_key: "S" }, base64 });
    const created = bodies[0].webhook as Record<string, unknown>;
    const set = bodies[1].webhook as Record<string, unknown>;
    assert.equal(created.base64, base64);
    assert.equal(set.base64, base64);
    assert.deepEqual(set.events, ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]);
    assert.equal(set.byEvents, false);
    assert.deepEqual(set.headers, { jwt_key: "S" });
  }
});

// ── Wiring (reads the source, like tests/wa-media-wiring.test.ts) ───────────

const read = (rel: string): string => {
  const file = path.join(__dirname, "..", rel);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
};
const CONNECT = read("src/app/api/apps/connect/whatsapp/route.ts");
const RUN = read("src/app/api/internal/reminders/run/route.ts");

test("connecting a line sets the webhook by the same list, and writes the mark it applied", () => {
  assert.match(CONNECT, /const webhookBase64 = !mediaEnabledFor\(tenantId\)/);
  assert.match(CONNECT, /createInstance\(cfg, \{[^}]*base64: webhookBase64/);
  assert.match(CONNECT, /setWebhook\(cfg, \{[^}]*base64: webhookBase64/);
  assert.equal((CONNECT.match(/\[WEBHOOK_BASE64_META\]: webhookBase64/g) ?? []).length >= 1, true);
});

test("the 15-minute round applies the webhooks before retrying files, inside the same error block and clock", () => {
  const block = RUN.slice(RUN.indexOf("async function runMediaChecks"));
  const reconcile = block.indexOf("reconcileWebhooks(");
  const purge = block.indexOf("runMediaPurge(");
  assert.ok(reconcile > 0 && reconcile < purge, "webhooks first, then the files");
  assert.match(block, /try \{[\s\S]*reconcileWebhooks[\s\S]*\} catch/);
});

test("a line that is not open right before is not applied: it is skipped as not connected", async () => {
  const { deps, calls } = world({ lines: [line(ON)], states: ["close"] });
  const result = await reconcileWebhooks(deps, FRESH);
  assert.equal(result.applied, 0);
  assert.equal(result.skipped.line_not_connected, 1);
  assert.ok(!calls.some((c) => c.startsWith("set:") || c.startsWith("mark:")));
});

test("a line that is not open after the change is counted in the result, readable from the job's answer", async () => {
  const { deps } = world({ lines: [line(ON)], states: ["open", "connecting"] });
  const result = await reconcileWebhooks(deps, FRESH);
  assert.equal(result.applied, 1);
  assert.equal(result.notOpenAfter, 1);
  const fine = world({ lines: [line(ON)] });
  assert.equal((await reconcileWebhooks(fine.deps, FRESH)).notOpenAfter, 0);
});
