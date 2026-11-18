// tests/address-search-wiring.test.ts
// Ticket #111: the address search must not switch itself off for a long saved address. A business whose typed address
// was longer than the search limit (121 characters in production) got "La búsqueda no está disponible ahora" on every
// visit to /admin/negocio, so its time zone could never be detected. Reads the source (no network).
// Run with: npx tsx --test tests/address-search-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const ROUTE = readFileSync(path.join(ROOT, "src/app/api/places/search/route.ts"), "utf8");
const SEARCH = readFileSync(path.join(ROOT, "src/components/shared/AddressSearch.tsx"), "utf8");
const LOCATION = readFileSync(path.join(ROOT, "src/lib/location.ts"), "utf8");

test("the search accepts any text a saved address can have (same 300 limit)", () => {
  assert.match(LOCATION, /address: z\.string\(\)\.trim\(\)\.min\(5\)\.max\(300\)/);
  assert.match(ROUTE, /query: z\.string\(\)\.trim\(\)\.min\(3\)\.max\(MAX_QUERY\)/);
  assert.match(ROUTE, /const MAX_QUERY = 300;/);
  assert.match(SEARCH, /query: text\.slice\(0, MAX_QUERY\)/);
});

test("only a failure of the service turns the search off; a rejected text is just no results", () => {
  assert.match(SEARCH, /if \(res\.status === 400\) \{\s*setSuggestions\(\[\]\);\s*setSearched\(true\);\s*return;\s*\}/);
});
