// tests/message-key-per-tenant.test.ts
// Run: npx tsx --test tests/message-key-per-tenant.test.ts
// QA 2026-11-20: WhatsApp gives a message the same id on both sides of a chat. When both numbers are on the platform
// (two businesses writing to each other), the first business that stored it took it from the other one, because
// whatsapp_messages.keyId was unique in the whole database. The key is now unique per business.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const model = schema.slice(schema.indexOf("model WhatsAppMessage"), schema.indexOf("}", schema.indexOf("model WhatsAppMessage")));

test("the schema makes the message key unique per business, not globally", () => {
  assert.match(model, /@@unique\(\[tenantId, keyId\]\)/);
  assert.doesNotMatch(model, /keyId\s+String\s+@unique/);
});

test("sync and the panel send look up and upsert by business and key", () => {
  const sync = readFileSync("src/app/api/internal/whatsapp/sync/route.ts", "utf8");
  const send = readFileSync("src/app/api/apps/whatsapp/chats/[id]/send/route.ts", "utf8");
  assert.doesNotMatch(sync, /where: \{ keyId \}/);
  assert.doesNotMatch(send, /where: \{ keyId \}/);
  assert.match(sync, /tenantId_keyId: \{ tenantId, keyId \}/);
  assert.match(send, /tenantId_keyId: \{ tenantId, keyId \}/);
});

test("the two migrations exist: add the per-business index first, drop the global one after the deploy", () => {
  const add = readFileSync("prisma/sql/34-message-key-per-tenant/up.sql", "utf8");
  const drop = readFileSync("prisma/sql/35-message-key-drop-global/up.sql", "utf8");
  assert.match(add, /CREATE UNIQUE INDEX "whatsapp_messages_tenantId_keyId_key"/);
  assert.match(drop, /DROP INDEX "whatsapp_messages_keyId_key"/);
});
