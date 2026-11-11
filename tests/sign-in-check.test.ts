// tests/sign-in-check.test.ts
// Run: npx tsx --test tests/sign-in-check.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DUMMY_BCRYPT_HASH, passwordMatches } from "../src/lib/sign-in-check";

const HASH = "$2b$12$abcdefghijklmnopqrstuuJ0fakefakefakefakefakefakefakefake";

function spy(result: boolean) {
  const calls: { plain: string; hash: string }[] = [];
  const compare = async (plain: string, hash: string) => {
    calls.push({ plain, hash });
    return result;
  };
  return { compare, calls };
}

test("an active account with the right password signs in", async () => {
  const { compare, calls } = spy(true);

  assert.equal(await passwordMatches({ passwordHash: HASH, isActive: true }, "secreto", compare), true);
  assert.deepEqual(calls, [{ plain: "secreto", hash: HASH }]);
});

test("a wrong password does not sign in", async () => {
  const { compare } = spy(false);

  assert.equal(await passwordMatches({ passwordHash: HASH, isActive: true }, "otra", compare), false);
});

test("a deactivated account never signs in, even with the right password", async () => {
  const { compare } = spy(true);

  assert.equal(await passwordMatches({ passwordHash: HASH, isActive: false }, "secreto", compare), false);
});

test("an unknown account never signs in", async () => {
  const { compare } = spy(true);

  assert.equal(await passwordMatches(null, "secreto", compare), false);
});

test("an account without a password, or with a value that is not a bcrypt hash, never signs in", async () => {
  const { compare } = spy(true);

  assert.equal(await passwordMatches({ passwordHash: null, isActive: true }, "secreto", compare), false);
  assert.equal(await passwordMatches({ passwordHash: "secreto", isActive: true }, "secreto", compare), false);
});

test("every case does one comparison, so the answer takes the same time whether the account exists or not", async () => {
  for (const account of [null, { passwordHash: null, isActive: true }, { passwordHash: HASH, isActive: false }]) {
    const { compare, calls } = spy(true);

    await passwordMatches(account, "secreto", compare);

    assert.deepEqual(calls, [{ plain: "secreto", hash: DUMMY_BCRYPT_HASH }]);
  }
});

test("the filler hash is a real bcrypt hash with the same cost as the stored ones", () => {
  assert.match(DUMMY_BCRYPT_HASH, /^\$2b\$12\$[./A-Za-z0-9]{53}$/);
});
