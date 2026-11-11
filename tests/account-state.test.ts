// tests/account-state.test.ts
// Run: npx tsx --test tests/account-state.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAccountAccess } from "../src/lib/account-state";

test("a user that no longer exists has no access", () => {
  assert.deepEqual(resolveAccountAccess(null), { kind: "none" });
});

test("a deactivated user has no access, whatever its role", () => {
  assert.deepEqual(resolveAccountAccess({ role: "STAFF", isActive: false, mustChangePassword: false, sessionVersion: 0 }), { kind: "none" });
  assert.deepEqual(resolveAccountAccess({ role: "ADMIN", isActive: false, mustChangePassword: false, sessionVersion: 0 }), { kind: "none" });
});

test("a deactivated user that also owes a password change still has no access", () => {
  assert.deepEqual(resolveAccountAccess({ role: "STAFF", isActive: false, mustChangePassword: true, sessionVersion: 0 }), { kind: "none" });
});

test("an active user with a temporary password may only change it", () => {
  assert.deepEqual(resolveAccountAccess({ role: "STAFF", isActive: true, mustChangePassword: true, sessionVersion: 0 }), {
    kind: "password_change",
  });
});

test("an active user gets the role stored in the database, not the one in an old token", () => {
  assert.deepEqual(resolveAccountAccess({ role: "STAFF", isActive: true, mustChangePassword: false, sessionVersion: 0 }), {
    kind: "active",
    role: "STAFF",
  });
  assert.deepEqual(resolveAccountAccess({ role: "CUSTOMER", isActive: true, mustChangePassword: false, sessionVersion: 0 }), {
    kind: "active",
    role: "CUSTOMER",
  });
});

// ── Session shape and Google sign-in (step 3) ───────────────────────────
import { googleSignInAllowed, sessionForAccess } from "../src/lib/account-state";

const SESSION = { expires: "2026-12-01T00:00:00.000Z", user: { id: "u1", tenantId: "t1", role: "STAFF", email: "ana@example.com" } };

test("an active account keeps its session as it is", () => {
  assert.equal(sessionForAccess(SESSION, "active"), SESSION);
});

test("a deactivated account gets a session with no user at all, so every route guard rejects it", () => {
  const locked = sessionForAccess(SESSION, "none");

  assert.deepEqual(locked, { expires: SESSION.expires });
  assert.equal("user" in locked, false);
});

test("an account that owes a password change gets no user either, only the flag the screens read", () => {
  const locked = sessionForAccess(SESSION, "password_change");

  assert.deepEqual(locked, { expires: SESSION.expires, mustChangePassword: true });
  assert.equal("user" in locked, false);
});

test("a token with no access decision is treated as no access", () => {
  assert.deepEqual(sessionForAccess(SESSION, undefined), { expires: SESSION.expires });
});

test("the original session is never modified", () => {
  sessionForAccess(SESSION, "none");

  assert.equal(SESSION.user.id, "u1");
});

test("Google sign-in is for owners and customers: a staff account must use email and password", () => {
  assert.equal(googleSignInAllowed({ role: "STAFF", isActive: true }), false);
  assert.equal(googleSignInAllowed({ role: "ADMIN", isActive: true }), true);
  assert.equal(googleSignInAllowed({ role: "CUSTOMER", isActive: true }), true);
});

test("Google sign-in is refused for a deactivated account of any role", () => {
  assert.equal(googleSignInAllowed({ role: "ADMIN", isActive: false }), false);
  assert.equal(googleSignInAllowed({ role: "CUSTOMER", isActive: false }), false);
});

test("Google sign-in is allowed when there is no account yet (a new customer)", () => {
  assert.equal(googleSignInAllowed(null), true);
});

// ── Where the browser goes when its session stops being usable (step 5) ──
import { CHANGE_PASSWORD_PATH, LOGIN_PATH, lockedDestination } from "../src/lib/account-state";

test("a session with a user needs no redirect", () => {
  assert.equal(lockedDestination({ user: { id: "u1" }, expires: "x" }), null);
});

test("a session that owes a password change goes to the change screen", () => {
  assert.equal(lockedDestination({ expires: "x", mustChangePassword: true }), CHANGE_PASSWORD_PATH);
});

test("a session with no user (deactivated, deleted or signed out) goes to login", () => {
  assert.equal(lockedDestination({ expires: "x" }), LOGIN_PATH);
  assert.equal(lockedDestination({}), LOGIN_PATH);
  assert.equal(lockedDestination(null), LOGIN_PATH);
});

test("only the exact flag sends to the change screen", () => {
  assert.equal(lockedDestination({ mustChangePassword: "yes" }), LOGIN_PATH);
});

// ── Session version: a reset or a deactivation ends every earlier session (security review) ──

const ACTIVE = { role: "STAFF", isActive: true, mustChangePassword: false, sessionVersion: 3 };

test("a session issued for the current version has access", () => {
  assert.deepEqual(resolveAccountAccess(ACTIVE, 3), { kind: "active", role: "STAFF" });
});

test("a session issued before the password was reset has no access, even after the user chooses a new password", () => {
  // The owner reset the password (version 2 to 3) and the user already chose a new one, so the flag is off.
  assert.deepEqual(resolveAccountAccess(ACTIVE, 2), { kind: "none" });
});

test("a session from an older version cannot even reach the change-password screen", () => {
  assert.deepEqual(resolveAccountAccess({ ...ACTIVE, mustChangePassword: true }, 2), { kind: "none" });
});

test("a session issued before versions existed counts as version 0, so nobody is signed out by the release", () => {
  const untouched = { role: "ADMIN", isActive: true, mustChangePassword: false, sessionVersion: 0 };
  assert.deepEqual(resolveAccountAccess(untouched, undefined), { kind: "active", role: "ADMIN" });
  assert.deepEqual(resolveAccountAccess(ACTIVE, undefined), { kind: "none" });
});
