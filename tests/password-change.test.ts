// tests/password-change.test.ts
// Run: npx tsx --test tests/password-change.test.ts
// A signed-in user changes their own password: the owner's card and the forced change after a temporary one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { changeOwnPassword, type PasswordChangeDeps } from "../src/lib/password-change";

const ACCOUNT = { tenantId: "tenant-a", userId: "u1" };
const CURRENT = "TempPassw0rdXYZ";
const NEXT = "una-clave-larga-2026";

function makeDeps(passwordHash: string | null | undefined) {
  const saved: { tenantId: string; userId: string; hash: string }[] = [];
  const deps: PasswordChangeDeps = {
    // undefined means the user does not exist in that business.
    findPasswordHash: async () => passwordHash,
    comparePassword: async (plain, hash) => hash === `hashed:${plain}`,
    hashPassword: async (plain) => `hashed:${plain}`,
    saveOwnPassword: async (tenantId, userId, hash) => {
      saved.push({ tenantId, userId, hash });
    },
  };
  return { deps, saved };
}

const input = (overrides: Partial<{ currentPassword: string | null; newPassword: string; confirmPassword: string }> = {}) => ({
  currentPassword: CURRENT,
  newPassword: NEXT,
  confirmPassword: NEXT,
  ...overrides,
});

test("the right current password and a valid new one are saved for that user and business", async () => {
  const { deps, saved } = makeDeps(`hashed:${CURRENT}`);

  const result = await changeOwnPassword(deps, ACCOUNT, input());

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(saved, [{ tenantId: "tenant-a", userId: "u1", hash: `hashed:${NEXT}` }]);
});

test("a wrong current password changes nothing", async () => {
  const { deps, saved } = makeDeps(`hashed:${CURRENT}`);

  const result = await changeOwnPassword(deps, ACCOUNT, input({ currentPassword: "otra-cosa-distinta" }));

  assert.deepEqual(result, { ok: false, reason: "current_password_invalid" });
  assert.equal(saved.length, 0);
});

test("an account with a password must send the current one", async () => {
  const { deps, saved } = makeDeps(`hashed:${CURRENT}`);

  const result = await changeOwnPassword(deps, ACCOUNT, input({ currentPassword: null }));

  assert.deepEqual(result, { ok: false, reason: "current_password_required" });
  assert.equal(saved.length, 0);
});

test("an account without a password (Google sign-in) may create one without a current password", async () => {
  const { deps, saved } = makeDeps(null);

  const result = await changeOwnPassword(deps, ACCOUNT, input({ currentPassword: null }));

  assert.deepEqual(result, { ok: true });
  assert.equal(saved.length, 1);
});

test("the two new passwords must match", async () => {
  const { deps, saved } = makeDeps(`hashed:${CURRENT}`);

  const result = await changeOwnPassword(deps, ACCOUNT, input({ confirmPassword: "una-clave-larga-2027" }));

  assert.deepEqual(result, { ok: false, reason: "password_mismatch" });
  assert.equal(saved.length, 0);
});

test("the new password cannot be the temporary one again", async () => {
  const { deps, saved } = makeDeps(`hashed:${CURRENT}`);

  const result = await changeOwnPassword(deps, ACCOUNT, input({ newPassword: CURRENT, confirmPassword: CURRENT }));

  assert.deepEqual(result, { ok: false, reason: "password_same_as_current" });
  assert.equal(saved.length, 0);
});

test("the new password follows the shared rules", async () => {
  const { deps } = makeDeps(`hashed:${CURRENT}`);

  assert.deepEqual(await changeOwnPassword(deps, ACCOUNT, input({ newPassword: "corta", confirmPassword: "corta" })), {
    ok: false,
    reason: "password_too_short",
  });
  assert.deepEqual(
    await changeOwnPassword(deps, ACCOUNT, input({ newPassword: "password1234", confirmPassword: "password1234" })),
    { ok: false, reason: "password_common" }
  );
});

test("a user that does not exist in that business gets the same answer as a wrong password", async () => {
  const { deps, saved } = makeDeps(undefined);

  const result = await changeOwnPassword(deps, ACCOUNT, input());

  assert.deepEqual(result, { ok: false, reason: "current_password_invalid" });
  assert.equal(saved.length, 0);
});

test("an empty stored hash counts as no password, so the account is not locked out", async () => {
  const { deps, saved } = makeDeps("");

  const result = await changeOwnPassword(deps, ACCOUNT, input({ currentPassword: null }));

  assert.deepEqual(result, { ok: true });
  assert.equal(saved.length, 1);
});

test("a user with a temporary password must always prove it, even if the account somehow has no password", async () => {
  const { deps, saved } = makeDeps(null);

  const result = await changeOwnPassword(deps, { ...ACCOUNT, mustProveCurrent: true }, input({ currentPassword: "" }));

  assert.deepEqual(result, { ok: false, reason: "current_password_invalid" });
  assert.equal(saved.length, 0);
});
