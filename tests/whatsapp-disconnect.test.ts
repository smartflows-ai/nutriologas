// tests/whatsapp-disconnect.test.ts
// Run: npx tsx --test tests/whatsapp-disconnect.test.ts
// The two Evolution steps of a WhatsApp disconnect. Fetch is injected: no network, no real instance.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { EvolutionConfig } from "../src/lib/messaging/evolution-adapter";
import { logoutReachedEvolution, removeIfClosed, requestLogout } from "../src/lib/whatsapp-disconnect";

type Handler = () => Response | Error;

const LOGOUT = "/instance/logout";
const STATE = "/instance/connectionState";
const DELETE = "/instance/delete";

/** Answers by path; records each path and the key it was called with. */
function fakeEvolution(handlers: Partial<Record<string, Handler>>) {
  const calls: Array<{ path: string; method: string; apiKey: string | undefined }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname.split("/").slice(0, 3).join("/");
    const headers = init.headers as Record<string, string>;
    calls.push({ path, method: String(init.method), apiKey: headers.apikey });
    const handler = handlers[path];
    const out = handler ? handler() : new Response("{}", { status: 500 });
    if (out instanceof Error) throw out;
    return out;
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const reply = (status: number, body: unknown = {}): Handler => () => new Response(JSON.stringify(body), { status });
const OPEN = reply(200, { instance: { state: "open" } });
const CONNECTING = reply(200, { instance: { state: "connecting" } });
const CLOSED = reply(200, { instance: { state: "close" } });

function cfgWith(fetchImpl: typeof fetch): EvolutionConfig {
  return { baseUrl: "https://evo.example.test", globalKey: "GLOBAL", fetchImpl, timeoutMs: 1000 };
}

const TIMEOUT = Object.assign(new Error("timeout"), { name: "TimeoutError" });
const NETWORK = new TypeError("fetch failed");

// ── Step 1: logout ──────────────────────────────────────────────────────────

test("requestLogout sends one logout with the instance token and reports its status", async () => {
  const { calls, fetchImpl } = fakeEvolution({ [LOGOUT]: reply(200) });
  const res = await requestLogout(cfgWith(fetchImpl), { instance: "clinic-1", instanceToken: "TOKEN-1" });

  assert.deepEqual(res, { logoutStatus: 200 });
  assert.deepEqual(calls, [{ path: LOGOUT, method: "DELETE", apiKey: "TOKEN-1" }]);
});

test("requestLogout uses the global key when the instance has no stored token", async () => {
  const { calls, fetchImpl } = fakeEvolution({ [LOGOUT]: reply(200) });
  await requestLogout(cfgWith(fetchImpl), { instance: "legacy-1", instanceToken: null });

  assert.equal(calls[0].apiKey, "GLOBAL");
});

test("requestLogout reports no status when Evolution never answers", async () => {
  const { fetchImpl } = fakeEvolution({ [LOGOUT]: () => NETWORK });
  const res = await requestLogout(cfgWith(fetchImpl), { instance: "clinic-1", instanceToken: "T" });

  assert.deepEqual(res, { logoutStatus: null });
  assert.equal(logoutReachedEvolution(res.logoutStatus), false);
});

test("an answered logout counts as reached, even with an error such as 'not connected'", () => {
  assert.equal(logoutReachedEvolution(200), true);
  assert.equal(logoutReachedEvolution(400), true);
  assert.equal(logoutReachedEvolution(null), false);
});

// ── Step 2: wait for the close, then delete ─────────────────────────────────

test("removeIfClosed waits while the session is open and deletes nothing", async () => {
  const { calls, fetchImpl } = fakeEvolution({ [STATE]: OPEN, [DELETE]: reply(200) });
  const res = await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" });

  assert.deepEqual(res, { kind: "waiting" });
  assert.equal(calls.some((c) => c.path === DELETE), false);
});

test("removeIfClosed also waits while the session is connecting", async () => {
  const { fetchImpl } = fakeEvolution({ [STATE]: CONNECTING });
  assert.deepEqual(await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" }), { kind: "waiting" });
});

test("removeIfClosed deletes with the global key once the session is closed", async () => {
  const { calls, fetchImpl } = fakeEvolution({ [STATE]: CLOSED, [DELETE]: reply(200) });
  const res = await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" });

  assert.deepEqual(res, { kind: "removed" });
  const del = calls.find((c) => c.path === DELETE);
  assert.equal(del?.method, "DELETE");
  assert.equal(del?.apiKey, "GLOBAL");
});

test("removeIfClosed treats an instance Evolution no longer has as removed", async () => {
  const { fetchImpl } = fakeEvolution({ [STATE]: reply(404), [DELETE]: reply(404) });
  assert.deepEqual(await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" }), { kind: "removed" });
});

test("removeIfClosed keeps waiting when the state cannot be read right now", async () => {
  const { fetchImpl } = fakeEvolution({ [STATE]: reply(500) });
  assert.deepEqual(await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" }), { kind: "waiting" });
});

test("a 400 from the delete is a failure with its status and Evolution's short message, digits masked", async () => {
  const body = { status: 400, error: "Bad Request", response: { message: "Instance 5218448441714 not found" } };
  const { fetchImpl } = fakeEvolution({ [STATE]: CLOSED, [DELETE]: reply(400, body) });
  const res = await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" });

  assert.deepEqual(res, {
    kind: "failed",
    deleteStatus: 400,
    deleteError: "http",
    deleteDetail: "Instance *** not found",
  });
});

test("a delete that times out is a failure with no HTTP status", async () => {
  const { fetchImpl } = fakeEvolution({ [STATE]: CLOSED, [DELETE]: () => TIMEOUT });
  const res = await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" });

  assert.equal(res.kind, "failed");
  assert.equal(res.kind === "failed" && res.deleteStatus, null);
  assert.equal(res.kind === "failed" && res.deleteError, "timeout");
});

test("a network error on the delete is a failure reported as network", async () => {
  const { fetchImpl } = fakeEvolution({ [STATE]: CLOSED, [DELETE]: () => NETWORK });
  const res = await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" });

  assert.equal(res.kind === "failed" && res.deleteError, "network");
});

test("the detail is cut at 120 characters", async () => {
  const body = { response: { message: "x".repeat(300) } };
  const { fetchImpl } = fakeEvolution({ [STATE]: CLOSED, [DELETE]: reply(400, body) });
  const res = await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" });

  assert.equal(res.kind === "failed" && res.deleteDetail?.length, 120);
});

test("a body that is not JSON gives its length only, never its content", async () => {
  const html = "<html>secret 5218448441714</html>";
  const { fetchImpl } = fakeEvolution({ [STATE]: CLOSED, [DELETE]: () => new Response(html, { status: 400 }) });
  const res = await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" });

  assert.equal(res.kind === "failed" && res.deleteDetail?.startsWith("shape: not json, "), true);
  assert.equal(res.kind === "failed" && res.deleteDetail?.includes("5218448441714"), false);
});

test("an object message is described by its shape, never printed as [object Object]", async () => {
  const body = { status: 400, error: "Bad Request", response: { message: { text: "secret text" } } };
  const { fetchImpl } = fakeEvolution({ [STATE]: CLOSED, [DELETE]: reply(400, body) });
  const res = await removeIfClosed(cfgWith(fetchImpl), { instance: "clinic-1" });

  assert.equal(res.kind === "failed" && res.deleteDetail, "shape: status:number, error:string, response:object");
});
