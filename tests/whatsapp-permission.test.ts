// tests/whatsapp-permission.test.ts
// Holes 4 and 5: the agenda's permission status. Run: npx tsx --test tests/whatsapp-permission.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { digitsOfJid, needsPermissionBadge, whatsappPermissionOf } from "../src/lib/whatsapp-permission";

const NO_OPTOUTS = new Set<string>();

test("a visit with consent recorded is YES", () => {
  assert.equal(whatsappPermissionOf({ whatsappConsentAt: new Date() }, "5215512345678", NO_OPTOUTS), "YES");
});

test("a visit without consent recorded is NONE", () => {
  assert.equal(whatsappPermissionOf({ whatsappConsentAt: null }, "5215512345678", NO_OPTOUTS), "NONE");
});

test("an opted-out patient is OPTED_OUT, even with consent recorded", () => {
  const out = new Set(["5215512345678"]);
  assert.equal(whatsappPermissionOf({ whatsappConsentAt: new Date() }, "5215512345678", out), "OPTED_OUT");
});

test("the JID is reduced to digits so it matches the stored phone", () => {
  assert.equal(digitsOfJid("5215512345678@s.whatsapp.net"), "5215512345678");
  assert.equal(digitsOfJid("5215512345678:12@s.whatsapp.net"), "5215512345678");
});

test("the badge shows for an upcoming visit without permission, not for one with it", () => {
  assert.equal(needsPermissionBadge("NONE", { status: "PENDING", customerPhone: "521" }), true);
  assert.equal(needsPermissionBadge("OPTED_OUT", { status: "CONFIRMED", customerPhone: "521" }), true);
  assert.equal(needsPermissionBadge("YES", { status: "PENDING", customerPhone: "521" }), false);
});

test("no badge for cancelled, deleted, or phone-less visits", () => {
  assert.equal(needsPermissionBadge("NONE", { status: "CANCELLED", customerPhone: "521" }), false);
  assert.equal(needsPermissionBadge("NONE", { status: "PENDING", customerPhone: "521", deleted: true }), false);
  assert.equal(needsPermissionBadge("NONE", { status: "PENDING", customerPhone: null }), false);
});

// QA 2026-11-20: the agenda compared the raw stored phone with the chat's JID digits (and the regex was /D/ instead
// of /\D/), so a visit saved as "+52..." or "52..." (12 digits) never showed "Opted out". Both sides now use the
// patient key (52 + 10 digits).
import { optedOutKeysOf } from "../src/lib/whatsapp-permission";
import { patientKeyOf } from "../src/lib/patient-key";

test("opt-outs are keyed by patient key, so every stored phone format matches the chat", () => {
  const keys = optedOutKeysOf(["5215512345678@s.whatsapp.net"]);
  for (const stored of ["+525512345678", "525512345678", "5215512345678", "+52 55 1234 5678", "5512345678"]) {
    assert.equal(whatsappPermissionOf({ whatsappConsentAt: null }, patientKeyOf(stored), keys), "OPTED_OUT", stored);
  }
});

test("an @lid chat (no phone) and an unusable JID add no key", () => {
  assert.equal(optedOutKeysOf(["123456789012345@lid", "abc@s.whatsapp.net"]).size, 0);
});

test("the agenda route matches by patient key, not the raw phone", () => {
  const source = readFileSync("src/app/api/appointments/route.ts", "utf8");
  assert.doesNotMatch(source, /replace\(\/D\/g/);
  assert.match(source, /whatsappPermissionOf\(a, patientKeyOf\(a\.customerPhone\)/);
});
