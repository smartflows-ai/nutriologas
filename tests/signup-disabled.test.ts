// tests/signup-disabled.test.ts
// Run: npx tsx --test tests/signup-disabled.test.ts
// Customer sign-up is switched off together with Google sign-in (ticket #151): /registro answers 404, the
// register API creates nothing, and no link points to the page. The code is kept (moved or commented), not
// deleted. Guest accounts made by a booking are a different path and are not touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

// Source with its comments removed: what is left is the code that actually runs.
function activeCode(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

// A page that calls notFound() under (auth)/layout.tsx (it wraps its children in Suspense) answers 200 with the
// "not found" screen, because the response has already started. Only a route that does not exist is a real 404.
test("there is no /registro route, so it answers a real 404", () => {
  assert.equal(existsSync(path.join(ROOT, "src/app/(auth)/registro/page.tsx")), false);
  assert.equal(existsSync(path.join(ROOT, "src/app/(auth)/registro/route.ts")), false);
});

test("the original signup form is kept, outside the route, so it can come back", () => {
  assert.equal(existsSync(path.join(ROOT, "src/app/(auth)/registro/SignupForm.tsx")), true);
});

test("POST /api/auth/register answers 404 and creates nothing", async () => {
  const route = await import("../src/app/api/auth/register/route");
  const res = await route.POST();
  assert.equal(res.status, 404);
  const code = activeCode("src/app/api/auth/register/route.ts");
  assert.doesNotMatch(code, /user\.create|bcrypt|createConektaCustomer/);
});

test("the register route exports only POST, and the original handler is kept as a comment", () => {
  const raw = readFileSync(path.join(ROOT, "src/app/api/auth/register/route.ts"), "utf8");
  assert.match(raw, /prisma\.user\.create/);
  const exported = activeCode("src/app/api/auth/register/route.ts").match(/export (?:async )?function \w+/g);
  assert.deepEqual(exported, ["export async function POST"]);
});

test("no active code links to /registro", () => {
  const offenders = sourceFiles(path.join(ROOT, "src"))
    .filter((file) => /["'`]\/registro\b/.test(readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")))
    .map((file) => path.relative(ROOT, file));
  assert.deepEqual(offenders, []);
});

test("nothing outside the disabled form calls the register API", () => {
  const callers = sourceFiles(path.join(ROOT, "src"))
    .filter((file) => /api\/auth\/register/.test(readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")))
    .map((file) => path.relative(ROOT, file))
    .filter((rel) => rel !== "src/app/(auth)/registro/SignupForm.tsx");
  assert.deepEqual(callers, []);
});

test("login, password recovery and business sign-up are untouched", () => {
  assert.match(activeCode("src/app/(auth)/login/page.tsx"), /signIn\(\s*["']credentials["']/);
  assert.equal(existsSync(path.join(ROOT, "src/app/(auth)/recuperar")), true);
  assert.match(activeCode("src/app/api/tenants/register/route.ts"), /export async function POST/);
});
