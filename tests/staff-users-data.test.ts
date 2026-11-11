// tests/staff-users-data.test.ts
// Run: npx tsx --test tests/staff-users-data.test.ts
// The two writes that enforce the seat limit, against a fake transaction that records the order of its calls.
// No database: what matters here is that the business is locked BEFORE its seats are counted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { activateStaffTx, createStaffTx, type SeatTx } from "../src/lib/staff-users-data";

const INPUT = { tenantId: "t1", email: "ana@example.com", name: "Ana", passwordHash: "hashed", limit: 3 };
const CREATED = { id: "u9", email: "ana@example.com", name: "Ana", role: "STAFF", isActive: true, mustChangePassword: true };

function fakeTx(seatsUsed: number, updated = 1) {
  const calls: string[] = [];
  const writes: unknown[] = [];
  const tx: SeatTx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      calls.push(`lock:${strings.join("?").replace(/\s+/g, " ").trim()}`);
      return [];
    },
    user: {
      count: async () => {
        calls.push("count");
        return seatsUsed;
      },
      create: async (args: unknown) => {
        calls.push("create");
        writes.push(args);
        return CREATED;
      },
      updateMany: async (args: unknown) => {
        calls.push("update");
        writes.push(args);
        return { count: updated };
      },
    },
  };
  return { tx, calls, writes };
}

test("creating locks the business row first, then counts, then inserts", async () => {
  const { tx, calls } = fakeTx(2);

  const result = await createStaffTx(tx, INPUT);

  assert.equal(result, CREATED);
  assert.equal(calls.length, 3);
  assert.match(calls[0], /^lock:SELECT id FROM "tenants" WHERE id = \? FOR NO KEY UPDATE$/);
  assert.deepEqual(calls.slice(1), ["count", "create"]);
});

test("creating inserts a STAFF user of that business that must change its password", async () => {
  const { tx, writes } = fakeTx(1);

  await createStaffTx(tx, INPUT);

  const { data } = writes[0] as { data: Record<string, unknown> };
  assert.deepEqual(data, {
    tenantId: "t1",
    email: "ana@example.com",
    name: "Ana",
    passwordHash: "hashed",
    role: "STAFF",
    mustChangePassword: true,
  });
});

test("creating with no free seat inserts nothing", async () => {
  const { tx, calls } = fakeTx(3);

  assert.equal(await createStaffTx(tx, INPUT), "limit_reached");
  assert.equal(calls.includes("create"), false);
});

test("activating locks first and only touches a STAFF row of that business", async () => {
  const { tx, calls, writes } = fakeTx(1);

  assert.equal(await activateStaffTx(tx, "t1", "u2", 2), "activated");
  assert.match(calls[0], /^lock:/);
  assert.deepEqual(calls.slice(1), ["count", "update"]);
  assert.deepEqual(writes[0], { where: { id: "u2", tenantId: "t1", role: "STAFF" }, data: { isActive: true } });
});

test("activating with no free seat changes nothing", async () => {
  const { tx, calls } = fakeTx(2);

  assert.equal(await activateStaffTx(tx, "t1", "u2", 2), "limit_reached");
  assert.equal(calls.includes("update"), false);
});

test("activating a row that is gone reports not found", async () => {
  const { tx } = fakeTx(1, 0);

  assert.equal(await activateStaffTx(tx, "t1", "u2", 2), "not_found");
});
