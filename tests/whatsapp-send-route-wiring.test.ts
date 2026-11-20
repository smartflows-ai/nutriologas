// tests/whatsapp-send-route-wiring.test.ts
// Ban prevention: the bot's send route uses the messaging service with the fixed CUSTOMER_REPLY purpose.
// Reads the source (no database). Run: npx tsx --test tests/whatsapp-send-route-wiring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const SOURCE = readFileSync(path.join(ROOT, "src/app/api/internal/whatsapp/send/route.ts"), "utf8").replace(/\r\n/g, "\n");
// Code only: the comments explain the design and may name the provider call they replace.
const ROUTE = SOURCE.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");

test("the bot send route checks the internal key and resolves the tenant from the instance", () => {
  assert.match(ROUTE, /isInternalKeyValid\(req\)/);
  assert.match(ROUTE, /resolveBotTenant\(instance\)/);
});

test("the purpose is fixed to CUSTOMER_REPLY and the body cannot change it", () => {
  assert.match(ROUTE, /purpose: "CUSTOMER_REPLY"/);
  assert.doesNotMatch(ROUTE, /body\??\.purpose/);
});

test("the send goes through the messaging service (sendWhatsAppMessage), not the provider directly", () => {
  assert.match(ROUTE, /sendWhatsAppMessage\(/);
  assert.doesNotMatch(ROUTE, /sendText|evolution-adapter/);
});

test("a reply is idempotent on the bot's own key", () => {
  assert.match(ROUTE, /startsWith\("bot-"\)/);
});
