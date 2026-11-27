// tests/evolution-adapter.test.ts
// Run: npx tsx --test tests/evolution-adapter.test.ts
// The adapter is the only code that talks to Evolution. Fetch is injected: no network, no real WhatsApp sends.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type EvolutionConfig,
  evolutionRequest,
  instanceKeyOf,
  sendText,
  connectionState,
  fetchInstanceInfo,
  connectQr,
  createInstance,
  setWebhook,
  webhookHeaders,
  typingDelayMs,
  findMessageByKey,
  mediaByKey,
} from "../src/lib/messaging/evolution-adapter";

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(responses: Array<{ status: number; body?: unknown } | Error>) {
  const calls: Call[] = [];
  let i = 0;
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (next instanceof Error) throw next;
    return new Response(next.body === undefined ? "" : JSON.stringify(next.body), { status: next.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function cfg(fetchImpl: typeof fetch): EvolutionConfig {
  return { baseUrl: "https://evo.example.com/", globalKey: "GLOBAL", timeoutMs: 1000, fetchImpl };
}

function headerOf(call: Call, name: string): string | undefined {
  return (call.init.headers as Record<string, string>)[name];
}

test("request joins the base URL without a double slash and sends the given key", async () => {
  const f = fakeFetch([{ status: 200, body: { ok: 1 } }]);
  const res = await evolutionRequest(cfg(f.impl), { path: "/instance/connectionState/abc", apiKey: "INST" });
  assert.equal(res.ok, true);
  assert.equal(f.calls[0].url, "https://evo.example.com/instance/connectionState/abc");
  assert.equal(headerOf(f.calls[0], "apikey"), "INST");
});

test("request never disables TLS: no custom agent is passed", async () => {
  const f = fakeFetch([{ status: 200, body: {} }]);
  await evolutionRequest(cfg(f.impl), { path: "/x", apiKey: "K" });
  assert.equal("agent" in (f.calls[0].init as object), false);
  assert.ok(f.calls[0].init.signal, "a timeout signal is always set");
});

test("an HTTP error is reported with its status and no body", async () => {
  const f = fakeFetch([{ status: 401, body: { message: "secret detail +5215512345678" } }]);
  const res = await evolutionRequest(cfg(f.impl), { path: "/x", apiKey: "K" });
  // Only the short message leaves the adapter, with the phone number masked; the rest of the body never does.
  assert.deepEqual(res, { ok: false, status: 401, error: "http", detail: "secret detail +***" });
});

test("a timeout and a network failure are told apart", async () => {
  const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
  const t = await evolutionRequest(cfg(fakeFetch([timeout]).impl), { path: "/x", apiKey: "K" });
  assert.deepEqual(t, { ok: false, status: null, error: "timeout" });
  const n = await evolutionRequest(cfg(fakeFetch([new TypeError("fetch failed")]).impl), { path: "/x", apiKey: "K" });
  assert.deepEqual(n, { ok: false, status: null, error: "network" });
});

test("instance names are URL-encoded", async () => {
  const f = fakeFetch([{ status: 200, body: { instance: { state: "open" } } }]);
  await connectionState(cfg(f.impl), { instance: "a b/c", apiKey: "K" });
  assert.equal(f.calls[0].url, "https://evo.example.com/instance/connectionState/a%20b%2Fc");
});

test("instanceKeyOf prefers the instance's own token and never returns an empty key", () => {
  assert.equal(instanceKeyOf("INST-TOKEN", "GLOBAL"), "INST-TOKEN");
  assert.equal(instanceKeyOf(null, "GLOBAL"), "GLOBAL");
  assert.equal(instanceKeyOf("  ", "GLOBAL"), "GLOBAL");
  // Legacy rows hold the global key itself; that still works until the backfill replaces it.
  assert.equal(instanceKeyOf("GLOBAL", "GLOBAL"), "GLOBAL");
});

test("sendText posts number, text and a typing delay, and returns the provider message id", async () => {
  const f = fakeFetch([{ status: 201, body: { key: { id: "MSG1" } } }]);
  const res = await sendText(cfg(f.impl), { instance: "inst", apiKey: "INST", number: "5215512345678", text: "Hola" , delayMs: 2000 });
  assert.equal(res.ok, true);
  assert.equal(res.ok && res.messageId, "MSG1");
  assert.equal(f.calls[0].url, "https://evo.example.com/message/sendText/inst");
  assert.equal(f.calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { number: "5215512345678", text: "Hola", delay: 2000 });
  assert.equal(headerOf(f.calls[0], "apikey"), "INST");
});

test("sendText without a delay sends no delay field", async () => {
  const f = fakeFetch([{ status: 201, body: {} }]);
  const res = await sendText(cfg(f.impl), { instance: "inst", apiKey: "K", number: "1", text: "x" });
  assert.equal(res.ok && res.messageId, null);
  assert.equal("delay" in JSON.parse(String(f.calls[0].init.body)), false);
});

test("connectionState reads every shape Evolution returns", async () => {
  for (const body of [{ instance: { state: "open" } }, { state: "open" }, { connectionStatus: "open" }]) {
    const f = fakeFetch([{ status: 200, body }]);
    assert.equal(await connectionState(cfg(f.impl), { instance: "i", apiKey: "K" }), "open");
  }
  const bad = fakeFetch([{ status: 500 }]);
  assert.equal(await connectionState(cfg(bad.impl), { instance: "i", apiKey: "K" }), null);
});

test("fetchInstanceInfo uses the global key and returns state, phone digits and the instance token", async () => {
  const f = fakeFetch([
    {
      status: 200,
      body: [
        { name: "other", connectionStatus: "open", ownerJid: "1@s.whatsapp.net", token: "T-OTHER" },
        { name: "mine", connectionStatus: "close", ownerJid: "5215512345678@s.whatsapp.net", token: "T-MINE" },
      ],
    },
  ]);
  const info = await fetchInstanceInfo(cfg(f.impl), "mine");
  assert.deepEqual(info, { state: "close", phone: "5215512345678", token: "T-MINE" });
  assert.equal(headerOf(f.calls[0], "apikey"), "GLOBAL");
  assert.equal(f.calls[0].url, "https://evo.example.com/instance/fetchInstances?instanceName=mine");
});

test("fetchInstanceInfo never falls back to another instance", async () => {
  const f = fakeFetch([{ status: 200, body: [{ name: "other", connectionStatus: "open", token: "T" }] }]);
  assert.equal(await fetchInstanceInfo(cfg(f.impl), "mine"), null);
});

test("connectQr returns the base64 code, or null", async () => {
  const ok = fakeFetch([{ status: 200, body: { base64: "data:image/png;base64,AAA" } }]);
  assert.equal(await connectQr(cfg(ok.impl), { instance: "i", apiKey: "K" }), "data:image/png;base64,AAA");
  const none = fakeFetch([{ status: 200, body: { instance: { state: "open" } } }]);
  assert.equal(await connectQr(cfg(none.impl), { instance: "i", apiKey: "K" }), null);
});

test("createInstance sends the required flags and webhook headers, and returns the instance token", async () => {
  const f = fakeFetch([{ status: 201, body: { hash: "NEW-TOKEN", qrcode: { base64: "QR" } } }]);
  const res = await createInstance(cfg(f.impl), {
    instance: "slug-tenant",
    webhookUrl: "https://n8n.example.com/webhook/id/slug-tenant",
    headers: { jwt_key: "S" },
  });
  assert.deepEqual(res, { ok: true, token: "NEW-TOKEN", qrCode: "QR", alreadyExists: false });
  const body = JSON.parse(String(f.calls[0].init.body));
  assert.equal(headerOf(f.calls[0], "apikey"), "GLOBAL");
  assert.equal(body.integration, "WHATSAPP-BAILEYS");
  assert.equal(body.rejectCall, true);
  assert.equal(body.groupsIgnore, true);
  assert.equal(body.syncFullHistory, false);
  assert.deepEqual(body.webhook.events, ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]);
  assert.deepEqual(body.webhook.headers, { jwt_key: "S" });
});

test("createInstance reports an instance that already exists", async () => {
  const f = fakeFetch([{ status: 403, body: { response: { message: ['This name "x" is already in use.'] } } }]);
  const res = await createInstance(cfg(f.impl), { instance: "x", webhookUrl: "u", headers: {} });
  assert.equal(res.ok, false);
});

test("setWebhook sends the secret headers with the instance key", async () => {
  const f = fakeFetch([{ status: 201, body: {} }]);
  const ok = await setWebhook(cfg(f.impl), { instance: "i", apiKey: "INST", url: "https://h/w", headers: { jwt_key: "S" } });
  assert.equal(ok, true);
  const body = JSON.parse(String(f.calls[0].init.body));
  assert.deepEqual(body.webhook.headers, { jwt_key: "S" });
  assert.equal(body.webhook.enabled, true);
  assert.equal(headerOf(f.calls[0], "apikey"), "INST");
});

test("webhookHeaders signs with the configured secret, and is empty when none is set", () => {
  assert.deepEqual(webhookHeaders("s3cret"), { jwt_key: "s3cret" });
  assert.deepEqual(webhookHeaders(undefined), {});
  assert.deepEqual(webhookHeaders("   "), {});
});

test("typingDelayMs grows with the text, stays within bounds and uses the jitter", () => {
  const short = typingDelayMs("Hola", () => 0);
  const long = typingDelayMs("x".repeat(2000), () => 0);
  assert.ok(short >= 1500 && short <= 8000);
  assert.ok(long <= 8000);
  assert.ok(long > short);
  assert.ok(typingDelayMs("Hola", () => 0.99) > short, "jitter adds time");
});

test("an error body whose message is a list is joined into the short detail", async () => {
  const f = fakeFetch([{ status: 400, body: { statusCode: 400, message: ["Instance not found", "check name"] } }]);
  const res = await evolutionRequest(cfg(f.impl), { path: "/x", apiKey: "K" });
  assert.deepEqual(res, { ok: false, status: 400, error: "http", detail: "Instance not found | check name" });
});

test("an error body without a readable message describes its shape only, never its values", async () => {
  const f = fakeFetch([{ status: 400, body: { statusCode: 400, reason: "owner 5215512345678" } }]);
  const res = await evolutionRequest(cfg(f.impl), { path: "/x", apiKey: "K" });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.detail?.includes("5215512345678"), false);
  assert.equal(res.ok === false && res.detail?.includes("statusCode:number"), true);
  assert.equal(res.ok === false && res.detail?.includes("reason:string"), true);
});

test("an error message that is an object is described by its shape, never printed as [object Object]", async () => {
  const f = fakeFetch([{ status: 400, body: { status: 400, error: "Bad Request", response: { message: { text: "secret text" } } } }]);
  const res = await evolutionRequest(cfg(f.impl), { path: "/x", apiKey: "K" });
  assert.equal(res.ok === false && res.detail, "shape: status:number, error:string, response:object");
});

test("a list of objects is described by its shape too", async () => {
  const f = fakeFetch([{ status: 400, body: { message: [{ a: 1 }] } }]);
  const res = await evolutionRequest(cfg(f.impl), { path: "/x", apiKey: "K" });
  assert.equal(res.ok === false && res.detail, "shape: message:array");
});

// ── #182: the two reads by message key (the file never travels in the webhook) ──

test("findMessageByKey asks for one message by its id with the instance key, and returns its records", async () => {
  const record = { key: { id: "ABC", fromMe: false }, messageType: "imageMessage", message: { imageMessage: { fileLength: "45362" } } };
  const f = fakeFetch([{ status: 200, body: { messages: { total: 1, records: [record] } } }]);
  const res = await findMessageByKey(cfg(f.impl), { instance: "slug-tenant", apiKey: "INST", keyId: "ABC" });
  assert.deepEqual(res, { ok: true, status: 200, data: [record] });
  assert.equal(f.calls[0].url, "https://evo.example.com/chat/findMessages/slug-tenant");
  assert.equal(f.calls[0].init.method, "POST");
  assert.equal(headerOf(f.calls[0], "apikey"), "INST");
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)).where, { key: { id: "ABC" } });
});

test("findMessageByKey gives an empty list when the connection has no such message", async () => {
  const f = fakeFetch([{ status: 200, body: { messages: { total: 0, records: [] } } }]);
  assert.deepEqual(await findMessageByKey(cfg(f.impl), { instance: "i", apiKey: "K", keyId: "X" }), { ok: true, status: 200, data: [] });
  const odd = fakeFetch([{ status: 200, body: { unexpected: true } }]);
  assert.deepEqual(await findMessageByKey(cfg(odd.impl), { instance: "i", apiKey: "K", keyId: "X" }), { ok: true, status: 200, data: [] });
});

test("mediaByKey sends only the key (id, chat, side) and returns the file bytes", async () => {
  const f = fakeFetch([{ status: 201, body: { mediaType: "imageMessage", base64: Buffer.from([0xff, 0xd8, 0xff]).toString("base64") } }]);
  const res = await mediaByKey(cfg(f.impl), { instance: "slug-tenant", apiKey: "INST", key: { id: "ABC", remoteJid: "c@s.whatsapp.net", fromMe: false } });
  assert.equal(res.ok, true);
  assert.deepEqual(res.ok && Array.from(res.data), [0xff, 0xd8, 0xff]);
  assert.equal(f.calls[0].url, "https://evo.example.com/chat/getBase64FromMediaMessage/slug-tenant");
  const body = JSON.parse(String(f.calls[0].init.body));
  assert.deepEqual(body, { message: { key: { id: "ABC", remoteJid: "c@s.whatsapp.net", fromMe: false } }, convertToMp4: false });
});

test("mediaByKey without bytes in the answer is an error, never an empty file", async () => {
  const f = fakeFetch([{ status: 201, body: { mediaType: "imageMessage" } }]);
  const res = await mediaByKey(cfg(f.impl), { instance: "i", apiKey: "K", key: { id: "A", remoteJid: "c@s.whatsapp.net", fromMe: false } });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error, "http");
});

test("a deadline given by the caller reaches the request, next to the adapter's own timeout", async () => {
  const controller = new AbortController();
  let seen: AbortSignal | undefined;
  const impl = (async (_url: string, init: RequestInit) => {
    seen = init.signal ?? undefined;
    controller.abort();
    if (seen?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const res = await mediaByKey(cfg(impl), { instance: "i", apiKey: "K", key: { id: "A", remoteJid: "c@s.whatsapp.net", fromMe: false }, signal: controller.signal });
  assert.equal(res.ok === false && res.error, "timeout");
  assert.ok(seen?.aborted, "the caller's deadline aborts the request");
});

test("findMessageByKey asks for a small page (offset is the page size in 2.3.7), so the matching record can be chosen", async () => {
  const f = fakeFetch([{ status: 200, body: { messages: { records: [] } } }]);
  await findMessageByKey(cfg(f.impl), { instance: "i", apiKey: "K", keyId: "ABC" });
  const body = JSON.parse(String(f.calls[0].init.body));
  assert.equal(body.page, 1);
  assert.equal(body.offset, 10);
});

test("mediaByKey refuses an answer that declares a body over the limit, without reading it", async () => {
  let read = false;
  const impl = (async () => {
    const res = new Response(JSON.stringify({ base64: "AAAA" }), { status: 201, headers: { "content-length": "2000" } });
    const text = res.text.bind(res);
    res.text = async () => ((read = true), text());
    return res;
  }) as unknown as typeof fetch;
  const res = await mediaByKey(cfg(impl), { instance: "i", apiKey: "K", key: { id: "A", remoteJid: "c@s.whatsapp.net", fromMe: false }, maxResponseBytes: 1000 });
  assert.equal(res.ok === false && res.error, "too_large");
  assert.equal(read, false, "the body is never read");
});

test("mediaByKey with a body under the limit, or without a declared length, reads it as before", async () => {
  const body = JSON.stringify({ base64: Buffer.from([1, 2]).toString("base64") });
  const impl = (async () => new Response(body, { status: 201, headers: { "content-length": String(body.length) } })) as unknown as typeof fetch;
  const ok = await mediaByKey(cfg(impl), { instance: "i", apiKey: "K", key: { id: "A", remoteJid: "c@s.whatsapp.net", fromMe: false }, maxResponseBytes: 1000 });
  assert.equal(ok.ok, true);
});
