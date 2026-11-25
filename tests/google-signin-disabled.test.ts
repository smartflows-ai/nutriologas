// tests/google-signin-disabled.test.ts
// Run: npx tsx --test tests/google-signin-disabled.test.ts
// Google sign-in is switched off while ticket #151 is open (a new customer could be saved in a business other
// than the store they came from). The code is commented out, not deleted, so it can be turned back on. This
// test fails if it comes back by accident: no active provider, no button, so /api/auth/signin/google does not exist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

// Source with its comments removed: what is left is the code that actually runs.
function activeCode(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("the NextAuth Google provider is not registered, so its sign-in route does not exist", () => {
  const auth = activeCode("src/lib/auth.ts");
  assert.doesNotMatch(auth, /GoogleProvider/);
  assert.doesNotMatch(auth, /providers\/google/);
});

test("the login page has no Google button", () => {
  const login = activeCode("src/app/(auth)/login/page.tsx");
  assert.doesNotMatch(login, /signIn\(\s*["']google["']/);
  assert.doesNotMatch(login, /continueGoogle/);
});

test("the signup form (kept, not routed) has no Google button", () => {
  const signup = activeCode("src/app/(auth)/registro/SignupForm.tsx");
  assert.doesNotMatch(signup, /signIn\(\s*["']google["']/);
  assert.doesNotMatch(signup, /continueGoogle/);
});

test("email and password sign-in is still there", () => {
  assert.match(activeCode("src/lib/auth.ts"), /CredentialsProvider\(/);
  assert.match(activeCode("src/app/(auth)/login/page.tsx"), /signIn\(\s*["']credentials["']/);
});

test("the Google Calendar connection is a different flow and is not touched", () => {
  const start = readFileSync(path.join(ROOT, "src/app/api/apps/oauth/google/start/route.ts"), "utf8");
  assert.match(start, /accounts\.google\.com/);
});
