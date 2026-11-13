// Short links on the tenant's own subdomain: /ubicacion (location) and /online/<code> (video call, per appointment).
// Run: npx tsx --test tests/short-links.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { SHORT_CODE_RE, customerMeetUrl, locationShortUrl, meetLinkState, newMeetShortCode } from "../src/lib/short-links";

const TENANT = { slug: "doctorgcenter", customDomain: null };
const START = new Date("2026-11-14T15:00:00.000Z");
const visit = (over: Partial<Parameters<typeof meetLinkState>[0]> = {}) => ({
  status: "CONFIRMED",
  modality: "ONLINE" as const,
  meetUrl: "https://meet.google.com/aaa-bbbb-ccc",
  appointmentDate: START,
  durationMinutes: 45,
  ...over,
});
const HOUR = 60 * 60 * 1000;
const end = START.getTime() + 45 * 60 * 1000;

test("short codes are 8 characters from the allowed alphabet and rarely repeat", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 10000; i++) {
    const c = newMeetShortCode();
    assert.match(c, SHORT_CODE_RE);
    assert.equal(c.length, 8);
    seen.add(c);
  }
  assert.equal(seen.size, 10000);
});

test("a malformed code never matches", () => {
  assert.equal(SHORT_CODE_RE.test("abc"), false);
  assert.equal(SHORT_CODE_RE.test("abc!defg"), false);
  assert.equal(SHORT_CODE_RE.test("aB3dE6fG"), true);
});

test("the meeting link is open from the start of the visit until one hour after it ends", () => {
  assert.equal(meetLinkState(visit(), new Date(START.getTime() - 24 * HOUR)).open, true);
  assert.equal(meetLinkState(visit(), new Date(end + HOUR)).open, true);
  assert.equal(meetLinkState(visit(), new Date(end + HOUR + 1000)).open, false);
});

test("a cancelled or released visit is closed, as is a visit with no secure link or not online", () => {
  assert.equal(meetLinkState(visit({ status: "CANCELLED" }), START).open, false);
  assert.equal(meetLinkState(visit({ status: "NO_SHOW" }), START).open, false);
  assert.equal(meetLinkState(visit({ meetUrl: "http://meet.example" }), START).open, false);
  assert.equal(meetLinkState(visit({ meetUrl: null }), START).open, false);
  assert.equal(meetLinkState(visit({ modality: "IN_PERSON" }), START).open, false);
});

test("the customer gets the short link when there is a code, the real link otherwise", () => {
  const withCode = customerMeetUrl({ meetUrl: "https://meet.google.com/aaa-bbbb-ccc", meetShortCode: "aB3dE6fG" }, TENANT);
  assert.equal(withCode, "https://doctorgcenter.newaigent.com/online/aB3dE6fG");
  const withoutCode = customerMeetUrl({ meetUrl: "https://meet.google.com/aaa-bbbb-ccc", meetShortCode: null }, TENANT);
  assert.equal(withoutCode, "https://meet.google.com/aaa-bbbb-ccc");
  assert.equal(customerMeetUrl({ meetUrl: null, meetShortCode: "aB3dE6fG" }, TENANT), "");
});

test("the location link uses the tenant's subdomain, or its custom domain when it has one", () => {
  assert.equal(locationShortUrl(TENANT), "https://doctorgcenter.newaigent.com/ubicacion");
  assert.equal(locationShortUrl({ slug: "doctorgcenter", customDomain: "clinica.mx" }), "https://clinica.mx/ubicacion");
});

import { readFileSync } from "node:fs";

const src = (rel: string) => readFileSync(rel, "utf8");

test("the location route redirects to the directions, rate limited, tenant from the host, never caching", () => {
  const s = src("src/app/ubicacion/route.ts");
  assert.match(s, /rateLimited\(`short-ubicacion:/);
  assert.match(s, /resolveTenantSlug\(req\.headers\.get\("host"\)/);
  assert.match(s, /directionsUrl\(/);
  assert.match(s, /NextResponse\.redirect\(/);
  assert.match(s, /SHORT_LINK_HEADERS/);
  assert.doesNotMatch(s, /searchParams|body\.tenant|tenantId\s*=\s*url/);
});

test("the online route answers closed for any code it does not open, and never leaks which codes exist", () => {
  const s = src("src/app/online/[code]/route.ts");
  assert.match(s, /rateLimited\(`short-online:/);
  assert.match(s, /SHORT_CODE_RE\.test\(code\)/);
  assert.match(s, /where: \{ tenantId: tenant\.id, meetShortCode: code \}/);
  assert.match(s, /meetLinkState\(visit, new Date\(\)\)\.open/);
  assert.match(s, /NextResponse\.redirect\(visit\.meetUrl/);
  // Every failure uses the same closed page: a code that exists and a code that does not look the same.
  assert.equal((s.match(/shortLinkUnavailable\(CLOSED\.titulo, CLOSED\.mensaje, 410\)/g) ?? []).length >= 4, true);
});

test("the customer-facing outputs use the short video link, the real link stays for admin and calendar", () => {
  for (const file of [
    "src/lib/reminder-data.ts",
    "src/app/api/internal/bot/book/route.ts",
    "src/app/api/internal/bot/my-appointments/route.ts",
    "src/app/api/internal/bot/confirm/route.ts",
    "src/app/api/apps/whatsapp/confirmations/[id]/route.ts",
    "src/app/api/appointments/[id]/route.ts",
  ]) {
    assert.match(src(file), /customerMeetUrl\(/, file);
  }
});

test("the migration and schema agree on the short code column and its unique index", () => {
  const up = readFileSync("prisma/sql/26-meet-short-code/up.sql", "utf8");
  const down = readFileSync("prisma/sql/26-meet-short-code/down.sql", "utf8");
  assert.match(up, /ADD COLUMN "meetShortCode" TEXT/);
  assert.match(up, /CREATE UNIQUE INDEX "appointments_tenantId_meetShortCode_key"/);
  assert.match(down, /DROP COLUMN "meetShortCode"/);
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /meetShortCode\s+String\?/);
  assert.match(schema, /@@unique\(\[tenantId, meetShortCode\]\)/);
});
