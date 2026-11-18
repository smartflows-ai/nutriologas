// tests/time-zone-guard.test.ts
// Ticket #111 (R3): one module converts times (src/lib/clinic-time.ts) and the zone list lives in src/lib/time-zones.ts.
// No other file under src/ may write a fixed zone or offset: each business uses its own (Tenant.timeZone).
// Reads the source (no database).
// Run with: npx tsx --test tests/time-zone-guard.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const ALLOWED = new Set(["src/lib/clinic-time.ts", "src/lib/time-zones.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) return sourceFiles(rel);
    return /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}

test("no file outside the clock module writes a fixed zone or offset", () => {
  const offenders: string[] = [];
  for (const rel of sourceFiles("src")) {
    if (ALLOWED.has(rel)) continue;
    const code = readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
    if (/America\/Mexico_City/.test(code) || /["'`]-06:00|-06:00["'`]|T\d{2}:\d{2}:\d{2}-06:00/.test(code)) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});

test("the business profile and the signup detect the zone only from saved coordinates", () => {
  const business = readFileSync(path.join(ROOT, "src/app/api/tenants/business/route.ts"), "utf8").replace(/\r\n/g, "\n");
  assert.match(business, /shouldDetectTimeZone\(zoneInput\) && locationData\?\.latitude != null && locationData\.longitude != null/);
  assert.match(business, /chooseTimeZone\(\{ \.\.\.zoneInput, detected \}\)/);
  assert.match(business, /time_zone_invalid/);
  const register = readFileSync(path.join(ROOT, "src/app/api/tenants/register/route.ts"), "utf8").replace(/\r\n/g, "\n");
  assert.match(register, /shouldDetectTimeZone\(zoneInput\) && location\?\.latitude != null && location\.longitude != null\s*\? await lookupTimeZone/);
  assert.match(register, /chooseTimeZone\(\{ \.\.\.zoneInput, detected: detectedZone \}\)/);
  assert.match(register, /suggestTimeZoneForPhone/);
});

test("picking an address gives the screen the zone of that place, from the same server call", () => {
  const details = readFileSync(path.join(ROOT, "src/app/api/places/details/route.ts"), "utf8").replace(/\r\n/g, "\n");
  assert.match(details, /latitude !== null && longitude !== null \? await lookupTimeZone\(latitude, longitude, realTimeZoneLookupDeps\) : null/);
  assert.match(details, /timeZone,\n/);
  const search = readFileSync(path.join(ROOT, "src/components/shared/AddressSearch.tsx"), "utf8").replace(/\r\n/g, "\n");
  assert.match(search, /timeZone: typeof data\.timeZone === "string" \? data\.timeZone : null/);
  const business = readFileSync(path.join(ROOT, "src/app/admin/negocio/page.tsx"), "utf8").replace(/\r\n/g, "\n");
  assert.match(business, /if \(next\?\.timeZone\) \{\s*setTimeZone\(next\.timeZone\)/);
  const signup = readFileSync(path.join(ROOT, "src/components/marketing/OnboardingModal.tsx"), "utf8").replace(/\r\n/g, "\n");
  assert.match(signup, /setTimeZone\(placeLocation\.timeZone\)/);
  assert.match(signup, /timeZone,\n\s*plan,/);
});

test("both layouts give client screens the business zone", () => {
  for (const rel of ["src/app/admin/layout.tsx", "src/app/(public)/layout.tsx"]) {
    assert.match(readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n"), /<BusinessTimeZoneProvider timeZone=/, rel);
  }
});
