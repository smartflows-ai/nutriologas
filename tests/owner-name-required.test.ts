// The owner or person in charge of the business is required: it is the name the customer messages mention.
// Run: npx tsx --test tests/owner-name-required.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownerNameIsFilled } from "../src/lib/owner-name";

test("an empty, blank or missing owner name is not filled", () => {
  assert.equal(ownerNameIsFilled(""), false);
  assert.equal(ownerNameIsFilled("   "), false);
  assert.equal(ownerNameIsFilled(null), false);
  assert.equal(ownerNameIsFilled(undefined), false);
});

test("a real owner name is filled", () => {
  assert.equal(ownerNameIsFilled("Dr. Gonzalo Soto"), true);
});

test("the business API refuses to save an empty owner name", () => {
  const src = readFileSync("src/app/api/tenants/business/route.ts", "utf8");
  assert.match(src, /ownerName !== undefined && !ownerNameIsFilled\(ownerName\)/);
  assert.match(src, /owner_name_required/);
});

test("the business page cannot save an empty owner name", () => {
  const src = readFileSync("src/app/admin/negocio/page.tsx", "utf8");
  assert.match(src, /!ownerNameIsFilled\(ownerName\)/);
  assert.match(src, /locationUi\.ownerNameRequired/);
});
