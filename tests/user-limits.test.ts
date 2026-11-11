// tests/user-limits.test.ts
// Run: npx tsx --test tests/user-limits.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { USER_LIMIT_BY_PLAN, canAddUser, userSeats } from "../src/lib/user-limits";

test("each plan allows the users the landing publishes: Start 1, Plus 2, Pro 3", () => {
  assert.deepEqual(USER_LIMIT_BY_PLAN, { START: 1, PLUS: 2, PRO: 3 });
});

test("Start has no room for staff: the owner already uses its only seat", () => {
  assert.equal(canAddUser("START", 1), false);
});

test("Plus accepts one staff user next to the owner and rejects a second one", () => {
  assert.equal(canAddUser("PLUS", 1), true);
  assert.equal(canAddUser("PLUS", 2), false);
});

test("Pro accepts two staff users next to the owner and rejects a third one", () => {
  assert.equal(canAddUser("PRO", 2), true);
  assert.equal(canAddUser("PRO", 3), false);
});

test("userSeats reports used, limit and how many are left", () => {
  assert.deepEqual(userSeats("PRO", 1), { used: 1, limit: 3, available: 2 });
});

test("userSeats never reports negative seats when a business is over its limit", () => {
  // A business that moved down from Pro to Start keeps its users but cannot add more.
  assert.deepEqual(userSeats("START", 3), { used: 3, limit: 1, available: 0 });
  assert.equal(canAddUser("START", 3), false);
});
