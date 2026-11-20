// tests/whatsapp-permission.test.ts
// Holes 4 and 5: the agenda's permission status. Run: npx tsx --test tests/whatsapp-permission.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
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
