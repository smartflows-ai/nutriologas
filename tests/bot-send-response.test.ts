// tests/bot-send-response.test.ts
// Run: npx tsx --test tests/bot-send-response.test.ts
// QA 2026-11-20: n8n reads a non-2xx answer of /api/internal/whatsapp/send as a failure and alerts the owner
// ("Alert Owner: Bot Failure") and raises "Respuesta no entregada". A reply the policy stopped on purpose (opt-out,
// kill switch, paused number) is not a failure: it answers 200 with blocked: true.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { botSendResponse } from "../src/lib/messaging/bot-send-response";

test("a sent reply is 200 and success", () => {
  assert.deepEqual(botSendResponse({ success: true }), { status: 200, body: { success: true, blocked: false, reason: null } });
});

test("a reply the policy blocked is 200, not success, blocked", () => {
  const res = botSendResponse({ success: false, reason: "x", data: { status: "BLOCKED" } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: false, blocked: true, reason: "x" });
});

test("a real failure stays 502 so n8n alerts", () => {
  for (const status of ["FAILED", "UNKNOWN", "QUEUED", undefined]) {
    const res = botSendResponse({ success: false, reason: "x", data: status ? { status } : undefined });
    assert.equal(res.status, 502, String(status));
    assert.equal(res.body.blocked, false);
  }
});

test("the send route answers through botSendResponse", () => {
  const route = readFileSync("src/app/api/internal/whatsapp/send/route.ts", "utf8");
  assert.match(route, /botSendResponse\(result\)/);
});

test("bot/help and bot/handoff refuse opted_out: only the inbound detection raises it", () => {
  const handler = readFileSync("src/lib/help-handler.ts", "utf8");
  assert.match(handler, /SERVER_ONLY_REASONS/);
  assert.match(handler, /"opted_out"/);
});

test("sync does not store a bot reply for an opted-out chat (it was never delivered)", () => {
  const sync = readFileSync("src/app/api/internal/whatsapp/sync/route.ts", "utf8");
  assert.match(sync, /skipped: "opted_out"/);
});
