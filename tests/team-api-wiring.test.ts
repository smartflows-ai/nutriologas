// tests/team-api-wiring.test.ts
// Run: npx tsx --test tests/team-api-wiring.test.ts
// Reads the route sources: the team APIs (ticket #22) must keep their guards, whatever else changes in them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const readRoot = (rel: string) => readFileSync(path.join(__dirname, "..", rel), "utf8");
const TEAM_ROUTES = ["src/app/api/admin/users/route.ts", "src/app/api/admin/users/[id]/route.ts"];

for (const rel of TEAM_ROUTES) {
  test(`${rel} is guarded by the users.manage permission on every handler`, () => {
    const source = readRoot(rel);
    const handlers = source.match(/export async function (GET|POST|PATCH|PUT|DELETE)/g) ?? [];
    const guards = source.match(/requirePermission\("users\.manage"\)/g) ?? [];
    assert.ok(handlers.length > 0);
    assert.equal(guards.length, handlers.length);
  });

  test(`${rel} takes the business from the session, never from the request`, () => {
    const source = readRoot(rel);
    assert.doesNotMatch(source, /body\.tenantId|searchParams\.get\("tenantId"\)|params\.tenantId/);
    // teamActor(guard) builds the actor from the session (src/lib/team-api.ts).
    assert.match(source, /teamActor\(guard\)|guard\.tenantId/);
  });

  test(`${rel} never logs a password and answers with no-store`, () => {
    const source = readRoot(rel);
    assert.doesNotMatch(source, /console\.(log|error)\([^)]*(tempPassword|password)/i);
    assert.match(source, /NO_STORE/);
  });
}

test("the password-change API accepts a user with a temporary password and rate limits by user", () => {
  const source = readRoot("src/app/api/auth/password-change/route.ts");
  assert.match(source, /getSessionAccess\(/);
  assert.match(source, /password_change/);
  assert.match(source, /rateLimited\(/);
  assert.match(source, /changeOwnPassword\(/);
});

test("the owner's password card uses the same shared rule", () => {
  const source = readRoot("src/app/api/tenants/account/password/route.ts");
  assert.match(source, /changeOwnPassword\(/);
  assert.doesNotMatch(source, /bcrypt/);
});

test("the WhatsApp reset ignores deactivated users and clears the temporary-password flag", () => {
  const source = readRoot("src/lib/password-reset-data.ts");
  assert.match(source, /isActive:\s*true/);
  assert.match(source, /mustChangePassword:\s*false/);
});

test("sign-in compares through passwordMatches, so a deactivated or unknown account takes the same time", () => {
  const source = readRoot("src/lib/auth.ts");
  assert.match(source, /passwordMatches\(/);
  assert.doesNotMatch(source, /bcrypt\.compare\(/);
});

test("the orders route rejects a session without a user with 401, not a crash", () => {
  assert.match(readRoot("src/app/api/orders/[id]/route.ts"), /!session\?\.user \|\|/);
});

test("the direct staff writes filter by id, business and the STAFF role through one shared filter", () => {
  // The transaction writes are tested with a fake transaction in tests/staff-users-data.test.ts.
  const source = readRoot("src/lib/staff-users-data.ts");
  assert.match(source, /const STAFF_ROW = \(tenantId: string, userId: string\)[^\n]*\{ id: userId, tenantId, role: STAFF_ROLE \}/);
  assert.doesNotMatch(source, /updateMany\(\{\s*where: \{/);
});

test("the team actor is built from the session guard only", () => {
  const source = readRoot("src/lib/team-api.ts");
  assert.match(source, /tenantId: guard\.tenantId, userId: guard\.session\.user\.id/);
});

test("Google sign-in is judged only on the account it signs in as, never on a lookup by email across businesses", () => {
  const source = readRoot("src/lib/auth.ts");
  assert.match(source, /if \(!googleSignInAllowed\(linked\)\) return false;/);
  assert.doesNotMatch(source, /googleSignInAllowed\(existing\)/);
});

test("a reset, a deactivation and a WhatsApp reset end every earlier session of that user", () => {
  const staff = readRoot("src/lib/staff-users-data.ts");
  assert.equal((staff.match(/sessionVersion: \{ increment: 1 \}/g) ?? []).length, 2);
  assert.match(readRoot("src/lib/password-reset-data.ts"), /sessionVersion: \{ increment: 1 \}/);
});

test("the session version travels in the token and is compared on every read", () => {
  const auth = readRoot("src/lib/auth.ts");
  assert.match(auth, /token\.sessionVersion = /);
  assert.match(auth, /readAccountAccess\(token\.tenantId, token\.id, /);
  assert.match(readRoot("src/lib/session.ts"), /readAccountAccess\([^)]*sessionVersion\)/);
});
