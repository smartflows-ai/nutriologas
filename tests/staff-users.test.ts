// tests/staff-users.test.ts
// Run: npx tsx --test tests/staff-users.test.ts
// The rules for the owner's team screen (ticket #22), with an in-memory store instead of the database.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStaffUser,
  resetStaffPassword,
  setStaffActive,
  type StaffDeps,
  type StaffUser,
} from "../src/lib/staff-users";
import type { CapabilityPlan } from "../src/lib/capabilities";

interface Row extends StaffUser {
  tenantId: string;
  passwordHash: string | null;
}

const OWNER_ID = "owner-a";
const TEMP = "TempPassw0rdXYZ";

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "u1",
    tenantId: "tenant-a",
    email: "ana@example.com",
    name: "Ana",
    role: "STAFF",
    isActive: true,
    mustChangePassword: false,
    passwordHash: "hashed:old",
    ...overrides,
  };
}

function makeStore(plan: CapabilityPlan, rows: Row[]) {
  // The store owns its copy: the rules never see or mutate the caller's rows.
  let data: readonly Row[] = rows.map((r) => ({ ...r }));
  let nextId = 1;
  const activeCrmUsers = (tenantId: string) =>
    data.filter((r) => r.tenantId === tenantId && r.isActive && (r.role === "ADMIN" || r.role === "STAFF")).length;
  // The real writes filter by id, tenant and STAFF role, and say whether a row changed.
  const isStaff = (tenantId: string, userId: string) =>
    data.some((r) => r.tenantId === tenantId && r.id === userId && r.role === "STAFF");
  const patch = (tenantId: string, userId: string, change: Partial<Row>): boolean => {
    data = data.map((r) => (r.tenantId === tenantId && r.id === userId ? { ...r, ...change } : r));
    return true;
  };
  const calls = { hash: 0, generate: 0 };
  const deps: StaffDeps = {
    planOf: async () => plan,
    findUserByEmail: async (tenantId, email) => data.find((r) => r.tenantId === tenantId && r.email === email) ?? null,
    findUserById: async (tenantId, userId) => data.find((r) => r.tenantId === tenantId && r.id === userId) ?? null,
    createStaffWithinLimit: async ({ tenantId, email, name, passwordHash, limit }) => {
      if (activeCrmUsers(tenantId) >= limit) return "limit_reached";
      // What the unique index (tenantId, email) does when two requests arrive at once.
      if (data.some((r) => r.tenantId === tenantId && r.email === email)) return "email_taken";
      const row = makeRow({ id: `new-${nextId++}`, tenantId, email, name, passwordHash, mustChangePassword: true });
      data = [...data, row];
      return row;
    },
    activateWithinLimit: async (tenantId, userId, limit) => {
      if (!isStaff(tenantId, userId)) return "not_found";
      if (activeCrmUsers(tenantId) >= limit) return "limit_reached";
      patch(tenantId, userId, { isActive: true });
      return "activated";
    },
    deactivate: async (tenantId, userId) => isStaff(tenantId, userId) && patch(tenantId, userId, { isActive: false }),
    saveTempPassword: async (tenantId, userId, passwordHash) =>
      isStaff(tenantId, userId) && patch(tenantId, userId, { passwordHash, mustChangePassword: true }),
    hashPassword: async (value) => {
      calls.hash += 1;
      return `hashed:${value}`;
    },
    generatePassword: () => {
      calls.generate += 1;
      return TEMP;
    },
  };
  // `remove` simulates another request deleting the user between the rule's read and its write.
  const remove = (userId: string) => {
    data = data.filter((r) => r.id !== userId);
  };
  return { deps, rows: () => data, calls, remove };
}

const owner = (tenantId = "tenant-a", id = OWNER_ID) =>
  makeRow({ id, tenantId, email: `${id}@example.com`, name: "Owner", role: "ADMIN" });
const ACTOR = { tenantId: "tenant-a", userId: OWNER_ID };

// ── Create ──────────────────────────────────────────────────────────────

test("the owner creates a staff user with a temporary password that must be changed", async () => {
  const store = makeStore("PRO", [owner()]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "ana@example.com", name: "Ana" });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.tempPassword, TEMP);
  assert.equal(result.user.role, "STAFF");
  assert.equal(result.user.mustChangePassword, true);
  const saved = store.rows().find((r) => r.email === "ana@example.com");
  assert.equal(saved?.passwordHash, `hashed:${TEMP}`);
  assert.equal(saved?.tenantId, "tenant-a");
});

test("the result never carries the password hash", async () => {
  const store = makeStore("PRO", [owner()]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "ana@example.com", name: "Ana" });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal("passwordHash" in result.user, false);
});

test("an email already registered as a customer of the business is rejected and the account is not converted", async () => {
  const customer = makeRow({ id: "c1", role: "CUSTOMER", email: "cliente@example.com" });
  const store = makeStore("PRO", [owner(), customer]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "cliente@example.com", name: "Cliente" });

  assert.deepEqual(result, { ok: false, reason: "email_already_registered" });
  assert.equal(store.rows().find((r) => r.id === "c1")?.role, "CUSTOMER");
  assert.equal(store.rows().length, 2);
});

test("the same email in another business does not block the creation", async () => {
  const other = makeRow({ id: "x1", tenantId: "tenant-b", email: "ana@example.com" });
  const store = makeStore("PRO", [owner(), other]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "ana@example.com", name: "Ana" });

  assert.equal(result.ok, true);
});

test("Start cannot create staff: its only seat is the owner", async () => {
  const store = makeStore("START", [owner()]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "ana@example.com", name: "Ana" });

  assert.deepEqual(result, { ok: false, reason: "user_limit_reached" });
  assert.equal(store.rows().length, 1);
});

test("Plus rejects a second staff user", async () => {
  const store = makeStore("PLUS", [owner(), makeRow({ id: "s1", email: "uno@example.com" })]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "dos@example.com", name: "Dos" });

  assert.deepEqual(result, { ok: false, reason: "user_limit_reached" });
});

test("a deactivated staff user does not use a seat", async () => {
  const store = makeStore("PLUS", [owner(), makeRow({ id: "s1", email: "uno@example.com", isActive: false })]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "dos@example.com", name: "Dos" });

  assert.equal(result.ok, true);
});

test("users of another business do not use this business's seats", async () => {
  const store = makeStore("PLUS", [owner(), owner("tenant-b", "owner-b"), makeRow({ id: "s9", tenantId: "tenant-b" })]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "nueva@example.com", name: "Nueva" });

  assert.equal(result.ok, true);
});

// ── Reset password ──────────────────────────────────────────────────────

test("resetting replaces the password and forces a change again", async () => {
  const store = makeStore("PRO", [owner(), makeRow({ id: "s1" })]);

  const result = await resetStaffPassword(store.deps, ACTOR, "s1");

  assert.deepEqual(result, { ok: true, tempPassword: TEMP });
  const saved = store.rows().find((r) => r.id === "s1");
  assert.equal(saved?.passwordHash, `hashed:${TEMP}`);
  assert.equal(saved?.mustChangePassword, true);
});

test("a staff user of another business is not found and is not changed", async () => {
  const store = makeStore("PRO", [owner(), makeRow({ id: "s9", tenantId: "tenant-b" })]);

  const result = await resetStaffPassword(store.deps, ACTOR, "s9");

  assert.deepEqual(result, { ok: false, reason: "user_not_found" });
  assert.equal(store.rows().find((r) => r.id === "s9")?.passwordHash, "hashed:old");
});

test("the owner cannot reset another owner, a customer or their own account from the team screen", async () => {
  const store = makeStore("PRO", [owner(), owner("tenant-a", "owner-2"), makeRow({ id: "c1", role: "CUSTOMER" })]);

  for (const targetId of [OWNER_ID, "owner-2", "c1", "missing"]) {
    assert.deepEqual(await resetStaffPassword(store.deps, ACTOR, targetId), { ok: false, reason: "user_not_found" });
  }
  assert.equal(store.rows().every((r) => r.passwordHash === "hashed:old"), true);
});

// ── Deactivate and activate ─────────────────────────────────────────────

test("deactivating a staff user turns the account off", async () => {
  const store = makeStore("PRO", [owner(), makeRow({ id: "s1" })]);

  const result = await setStaffActive(store.deps, ACTOR, "s1", false);

  assert.deepEqual(result, { ok: true });
  assert.equal(store.rows().find((r) => r.id === "s1")?.isActive, false);
});

test("the owner cannot deactivate their own account or another owner", async () => {
  const store = makeStore("PRO", [owner(), owner("tenant-a", "owner-2")]);

  assert.deepEqual(await setStaffActive(store.deps, ACTOR, OWNER_ID, false), { ok: false, reason: "user_not_found" });
  assert.deepEqual(await setStaffActive(store.deps, ACTOR, "owner-2", false), { ok: false, reason: "user_not_found" });
  assert.equal(store.rows().every((r) => r.isActive), true);
});

test("a staff user of another business cannot be deactivated", async () => {
  const store = makeStore("PRO", [owner(), makeRow({ id: "s9", tenantId: "tenant-b" })]);

  const result = await setStaffActive(store.deps, ACTOR, "s9", false);

  assert.deepEqual(result, { ok: false, reason: "user_not_found" });
  assert.equal(store.rows().find((r) => r.id === "s9")?.isActive, true);
});

test("activating a staff user checks the seats again", async () => {
  const store = makeStore("PLUS", [
    owner(),
    makeRow({ id: "s1", email: "uno@example.com" }),
    makeRow({ id: "s2", email: "dos@example.com", isActive: false }),
  ]);

  const result = await setStaffActive(store.deps, ACTOR, "s2", true);

  assert.deepEqual(result, { ok: false, reason: "user_limit_reached" });
  assert.equal(store.rows().find((r) => r.id === "s2")?.isActive, false);
});

test("activating a staff user works when a seat is free", async () => {
  const store = makeStore("PLUS", [owner(), makeRow({ id: "s2", isActive: false })]);

  const result = await setStaffActive(store.deps, ACTOR, "s2", true);

  assert.deepEqual(result, { ok: true });
  assert.equal(store.rows().find((r) => r.id === "s2")?.isActive, true);
});

test("activating a user that is already active changes nothing and does not count a seat twice", async () => {
  const store = makeStore("PLUS", [owner(), makeRow({ id: "s1" })]);

  const result = await setStaffActive(store.deps, ACTOR, "s1", true);

  assert.deepEqual(result, { ok: true });
});

// ── Review follow-ups ───────────────────────────────────────────────────

test("the email is stored trimmed and in lowercase, the way sign-in looks it up", async () => {
  const store = makeStore("PRO", [owner()]);

  const result = await createStaffUser(store.deps, ACTOR, { email: "  Ana@Example.COM ", name: "  Ana  " });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.user.email, "ana@example.com");
  assert.equal(result.user.name, "Ana");
});

test("an email that differs only in case or spaces from an existing user is rejected", async () => {
  const store = makeStore("PRO", [owner(), makeRow({ id: "c1", role: "CUSTOMER", email: "ana@example.com" })]);

  const result = await createStaffUser(store.deps, ACTOR, { email: " ANA@example.com", name: "Ana" });

  assert.deepEqual(result, { ok: false, reason: "email_already_registered" });
});

test("no password is generated or hashed when the email is already registered", async () => {
  const store = makeStore("PRO", [owner(), makeRow({ id: "c1", role: "CUSTOMER" })]);

  await createStaffUser(store.deps, ACTOR, { email: "ana@example.com", name: "Ana" });

  assert.deepEqual(store.calls, { hash: 0, generate: 0 });
});

test("two requests creating the same email at once: the one that loses gets the clear message, not a crash", async () => {
  const store = makeStore("PRO", [owner()]);
  // The first read finds nothing for both requests; the unique index stops the second insert.
  const racing: StaffDeps = { ...store.deps, findUserByEmail: async () => null };
  await createStaffUser(racing, ACTOR, { email: "ana@example.com", name: "Ana" });

  const second = await createStaffUser(racing, ACTOR, { email: "ana@example.com", name: "Ana" });

  assert.deepEqual(second, { ok: false, reason: "email_already_registered" });
  assert.equal(store.rows().filter((r) => r.email === "ana@example.com").length, 1);
});

test("a deactivated staff user can get a new temporary password and stays deactivated", async () => {
  const store = makeStore("PRO", [owner(), makeRow({ id: "s1", isActive: false })]);

  const result = await resetStaffPassword(store.deps, ACTOR, "s1");

  assert.deepEqual(result, { ok: true, tempPassword: TEMP });
  assert.equal(store.rows().find((r) => r.id === "s1")?.isActive, false);
});

test("deactivating a user that is already deactivated changes nothing", async () => {
  const store = makeStore("PRO", [owner(), makeRow({ id: "s1", isActive: false })]);

  assert.deepEqual(await setStaffActive(store.deps, ACTOR, "s1", false), { ok: true });
});

test("a user deleted between the check and the write is reported as not found, never as done", async () => {
  for (const act of [
    (deps: StaffDeps) => resetStaffPassword(deps, ACTOR, "s1"),
    (deps: StaffDeps) => setStaffActive(deps, ACTOR, "s1", false),
  ]) {
    const store = makeStore("PRO", [owner(), makeRow({ id: "s1" })]);
    const found = makeRow({ id: "s1" });
    store.remove("s1");
    const stale: StaffDeps = { ...store.deps, findUserById: async () => found };

    assert.deepEqual(await act(stale), { ok: false, reason: "user_not_found" });
  }
});

test("activating a user deleted between the check and the write is reported as not found", async () => {
  const store = makeStore("PRO", [owner()]);
  const stale: StaffDeps = { ...store.deps, findUserById: async () => makeRow({ id: "s1", isActive: false }) };

  assert.deepEqual(await setStaffActive(stale, ACTOR, "s1", true), { ok: false, reason: "user_not_found" });
});

test("a business over its limit after moving to a smaller plan cannot activate another user", async () => {
  const store = makeStore("START", [owner(), makeRow({ id: "s1" }), makeRow({ id: "s2", email: "dos@example.com", isActive: false })]);

  assert.deepEqual(await setStaffActive(store.deps, ACTOR, "s2", true), { ok: false, reason: "user_limit_reached" });
});
