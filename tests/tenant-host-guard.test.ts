// tests/tenant-host-guard.test.ts
// Run: npx tsx --test tests/tenant-host-guard.test.ts
// Ticket #146: the session cookie is shared by every subdomain, so the business of the host must be compared
// with the business of the session. The rule is pure; the hosts go through the real resolveTenantSlug.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTenantSlug } from "../src/lib/tenant";
import { checkHostAgainstSession, businessHomeUrl, accessWithHost } from "../src/lib/tenant-host-guard";

const newy = { slug: "newy", customDomain: null };
const clinic = { slug: "clinic", customDomain: "myclinic.com" };

const check = (host: string, business: typeof newy | typeof clinic | null) =>
  checkHostAgainstSession({ hostSlug: resolveTenantSlug(host), business }).kind;

test("the host of the session's own business passes", () => {
  assert.equal(check("newy.newaigent.com", newy), "same");
  assert.equal(check("NEWY.newaigent.com:443", newy), "same");
});

test("the host of another business is a mismatch", () => {
  assert.equal(check("doctorgcenter.newaigent.com", newy), "other_business");
});

test("a custom domain matches the business that owns it, and no other", () => {
  assert.equal(check("myclinic.com", clinic), "same");
  assert.equal(check("MyClinic.com", clinic), "same");
  assert.equal(check("myclinic.com", newy), "other_business");
});

test("the subdomain of a business with a custom domain still matches it", () => {
  assert.equal(check("clinic.newaigent.com", clinic), "same");
});

test("the root domain is not blocked: it is the marketing page and the OAuth callback", () => {
  assert.equal(check("newaigent.com", newy), "neutral");
  assert.equal(check("www.newaigent.com", newy), "neutral");
});

test("localhost without a subdomain is not blocked", () => {
  assert.equal(check("localhost:3000", newy), "neutral");
  assert.equal(check("127.0.0.1:3000", newy), "neutral");
});

test("a local subdomain is compared like a production one", () => {
  assert.equal(check("newy.localhost:3000", newy), "same");
  assert.equal(check("doctor.localhost:3000", newy), "other_business");
});

test("a session whose business cannot be found fails closed on a business host", () => {
  assert.equal(check("newy.newaigent.com", null), "other_business");
});

test("a session whose business cannot be found is not blocked on the root domain", () => {
  assert.equal(check("newaigent.com", null), "neutral");
});

test("the host of a business that does not exist is a mismatch", () => {
  assert.equal(check("nobody-here.newaigent.com", newy), "other_business");
});

test("a partial match is not a match", () => {
  assert.equal(check("newy2.newaigent.com", newy), "other_business");
  assert.equal(check("xnewy.newaigent.com", newy), "other_business");
});

test("the redirect goes to the session's business subdomain in production", () => {
  assert.equal(
    businessHomeUrl({ slug: "newy", currentHost: "doctorgcenter.newaigent.com", rootDomain: "newaigent.com" }),
    "https://newy.newaigent.com"
  );
});

test("the redirect keeps http and the port on a local subdomain", () => {
  assert.equal(
    businessHomeUrl({ slug: "newy", currentHost: "doctor.localhost:3000", rootDomain: "newaigent.com" }),
    "http://newy.localhost:3000"
  );
});

test("the redirect from a custom domain also goes to the shared-cookie subdomain", () => {
  assert.equal(
    businessHomeUrl({ slug: "newy", currentHost: "myclinic.com", rootDomain: "newaigent.com" }),
    "https://newy.newaigent.com"
  );
});

test("a forged port in the host can never turn the redirect into another site", () => {
  const url = businessHomeUrl({ slug: "newy", currentHost: "localhost:80@evil.example", rootDomain: "newaigent.com" });
  assert.equal(new URL(url).hostname, "newy.localhost");
  assert.equal(new URL(url).username, "");
});

test("the redirect target always passes the rule, so it cannot loop", () => {
  for (const currentHost of ["doctorgcenter.newaigent.com", "myclinic.com", "doctor.localhost:3000"]) {
    const target = new URL(businessHomeUrl({ slug: "newy", currentHost, rootDomain: "newaigent.com" }));
    assert.equal(checkHostAgainstSession({ hostSlug: resolveTenantSlug(target.host), business: newy }).kind, "same");
  }
});

test("only an active account is turned into other_business; locked accounts keep their own answer", () => {
  assert.equal(accessWithHost("active", "other_business"), "other_business");
  assert.equal(accessWithHost("active", "same"), "active");
  assert.equal(accessWithHost("active", "neutral"), "active");
  assert.equal(accessWithHost("password_change", "other_business"), "other_business");
  assert.equal(accessWithHost("none", "other_business"), "none");
  assert.equal(accessWithHost(undefined, "other_business"), "none");
});

// ── Wiring: the rule must stay connected, and no new reader may skip it ─────────────
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test("the NextAuth jwt callback turns the host into the access kind, so every getServerSession route is covered", () => {
  const auth = read("src/lib/auth.ts");
  assert.match(auth, /checkRequestHost\(/);
  assert.match(auth, /accessWithHost\(/);
});

test("getSessionAccess knows about another business's host, and the CRM gate redirects it", () => {
  assert.match(read("src/lib/session.ts"), /checkRequestHost\(/);
  const guard = read("src/lib/permission-guard.ts");
  assert.match(guard, /access\.kind === "other_business"/);
  assert.match(guard, /redirect\(access\.homeUrl/);
});

test("requirePermission answers 403 on another business's host, not a plain 401", () => {
  const guard = read("src/lib/permission-guard.ts");
  assert.match(guard, /other_business" \? 403 : 401/);
});

test("only session.ts and the middleware decode the session cookie by hand", () => {
  const offenders = sourceFiles(path.join(ROOT, "src"))
    .filter((file) => /from "next-auth\/jwt"/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(ROOT, file))
    .filter((rel) => !["src/lib/session.ts", "src/middleware.ts", "src/types/next-auth.d.ts"].includes(rel));
  assert.deepEqual(offenders, []);
});
