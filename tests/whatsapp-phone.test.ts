// tests/whatsapp-phone.test.ts
// Run: npx tsx --test tests/whatsapp-phone.test.ts
// QA 2026-11-20: the WhatsApp screen showed "Conectado:" with no number. The number was saved only while the
// /admin/apps modal polled the QR, and Evolution fills ownerJid a moment after the connection opens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { needsPhoneBackfill, phoneFromJid } from "../src/lib/whatsapp-phone";

test("a phone JID gives its digits; a device suffix is dropped", () => {
  assert.equal(phoneFromJid("5215512345678@s.whatsapp.net"), "5215512345678");
  assert.equal(phoneFromJid("5215512345678:12@s.whatsapp.net"), "5215512345678");
  assert.equal(phoneFromJid("5215512345678"), "5215512345678");
});

test("an @lid, an empty value or a short value gives nothing", () => {
  assert.equal(phoneFromJid("123456789012345@lid"), null);
  assert.equal(phoneFromJid(""), null);
  assert.equal(phoneFromJid(null), null);
  assert.equal(phoneFromJid(42), null);
  assert.equal(phoneFromJid("1234@s.whatsapp.net"), null);
});

test("a connected line without a saved number needs the backfill; anything else does not", () => {
  assert.equal(needsPhoneBackfill({ waStatus: "connected", waPhoneNumber: null, waInstanceId: "newy-1" }), true);
  assert.equal(needsPhoneBackfill({ waStatus: "connected", waPhoneNumber: "", waInstanceId: "newy-1" }), true);
  assert.equal(needsPhoneBackfill({ waStatus: "connected", waPhoneNumber: "5215512345678", waInstanceId: "newy-1" }), false);
  assert.equal(needsPhoneBackfill({ waStatus: "qr_pending", waPhoneNumber: null, waInstanceId: "newy-1" }), false);
  assert.equal(needsPhoneBackfill({ waStatus: "connected", waPhoneNumber: null, waInstanceId: null }), false);
});

test("the config route fills a missing number from Evolution and never returns the instance id", () => {
  const route = readFileSync("src/app/api/apps/whatsapp/config/route.ts", "utf8");
  assert.match(route, /needsPhoneBackfill\(app\)/);
  assert.match(route, /fetchInstanceInfo\(cfg, app\.waInstanceId/);
  assert.match(route, /const \{ waInstanceId: _instance, \.\.\.visible \} = app/);
});

test("an open connection event saves the number Evolution sends with it", () => {
  const route = readFileSync("src/app/api/internal/whatsapp/connection/route.ts", "utf8");
  assert.match(route, /phoneFromJid\(data\.wuid\)/);
});

test("the adapter also reads the nested instance shape and never falls back to another instance", () => {
  const adapter = readFileSync("src/lib/messaging/evolution-adapter.ts", "utf8");
  assert.match(adapter, /inst\.instance\?\.ownerJid/);
  assert.doesNotMatch(adapter, /\|\| list\[0\]|\?\? list\[0\]/);
});

test("the header shows Conectado without the colon when there is no number", () => {
  const page = readFileSync("src/app/admin/whatsapp/page.tsx", "utf8");
  assert.match(page, /config\.waPhoneNumber \? `\$\{t\.crm\.whatsapp\.connected\} \$\{config\.waPhoneNumber\}` : t\.crm\.whatsapp\.connectedNoNumber/);
});
