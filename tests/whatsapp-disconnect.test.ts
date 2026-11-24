// tests/whatsapp-disconnect.test.ts
// Run: npx tsx --test tests/whatsapp-disconnect.test.ts
// Disconnecting a WhatsApp line must remove its Evolution instance too. Fetch is injected: no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { EvolutionConfig } from "../src/lib/messaging/evolution-adapter";
import { removeWhatsAppInstance, shouldDeleteRecord } from "../src/lib/whatsapp-disconnect";

interface Call {
  method: string;
  url: string;
  apiKey: string | undefined;
}

function fakeEvolution(statuses: Array<number | Error>) {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    calls.push({ method: String(init.method), url, apiKey: headers.apikey });
    const next = statuses[Math.min(i, statuses.length - 1)];
    i += 1;
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify({}), { status: next });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function cfgWith(fetchImpl: typeof fetch): EvolutionConfig {
  return { baseUrl: "https://evo.example.test", globalKey: "GLOBAL", fetchImpl, timeoutMs: 1000 };
}

const TIMEOUT = Object.assign(new Error("timeout"), { name: "TimeoutError" });
const NETWORK = new TypeError("fetch failed");

test("logs out with the instance token, then deletes with the global key", async () => {
  const { calls, fetchImpl } = fakeEvolution([200, 200]);
  const result = await removeWhatsAppInstance(cfgWith(fetchImpl), { instance: "clinic-1", instanceToken: "TOKEN-1" });

  assert.equal(result.outcome, "removed");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].url, "https://evo.example.test/instance/logout/clinic-1");
  assert.equal(calls[0].apiKey, "TOKEN-1");
  assert.equal(calls[1].method, "DELETE");
  assert.equal(calls[1].url, "https://evo.example.test/instance/delete/clinic-1");
  assert.equal(calls[1].apiKey, "GLOBAL");
});

test("falls back to the global key for logout when the instance has no stored token", async () => {
  const { calls, fetchImpl } = fakeEvolution([200, 200]);
  await removeWhatsAppInstance(cfgWith(fetchImpl), { instance: "legacy-1", instanceToken: null });

  assert.equal(calls[0].apiKey, "GLOBAL");
});

test("a failed logout does not stop the delete, and its status is reported", async () => {
  const { calls, fetchImpl } = fakeEvolution([500, 200]);
  const result = await removeWhatsAppInstance(cfgWith(fetchImpl), { instance: "clinic-1", instanceToken: "T" });

  assert.equal(result.outcome, "removed");
  assert.equal(result.logoutStatus, 500);
  assert.equal(calls.length, 2);
});

test("an instance Evolution no longer has counts as already gone", async () => {
  const { fetchImpl } = fakeEvolution([404, 404]);
  const result = await removeWhatsAppInstance(cfgWith(fetchImpl), { instance: "clinic-1", instanceToken: "T" });

  assert.equal(result.outcome, "already_gone");
  assert.equal(result.deleteStatus, 404);
});

test("an HTTP error from the delete is a failure, never treated as removed, and keeps its status", async () => {
  const { fetchImpl } = fakeEvolution([200, 401]);
  const result = await removeWhatsAppInstance(cfgWith(fetchImpl), { instance: "clinic-1", instanceToken: "T" });

  assert.deepEqual(result, { outcome: "failed", deleteStatus: 401, deleteError: "http", logoutStatus: 200 });
});

test("a timeout on the delete is a failure with no HTTP status", async () => {
  const { fetchImpl } = fakeEvolution([200, TIMEOUT]);
  const result = await removeWhatsAppInstance(cfgWith(fetchImpl), { instance: "clinic-1", instanceToken: "T" });

  assert.equal(result.outcome, "failed");
  assert.equal(result.deleteStatus, null);
  assert.equal(result.deleteError, "timeout");
});

test("a network error on the delete is a failure, reported as network", async () => {
  const { fetchImpl } = fakeEvolution([200, NETWORK]);
  const result = await removeWhatsAppInstance(cfgWith(fetchImpl), { instance: "clinic-1", instanceToken: "T" });

  assert.equal(result.outcome, "failed");
  assert.equal(result.deleteError, "network");
});

test("the database row is deleted only when Evolution confirms the instance is gone", () => {
  assert.equal(shouldDeleteRecord("removed"), true);
  assert.equal(shouldDeleteRecord("already_gone"), true);
  assert.equal(shouldDeleteRecord("failed"), false);
});
