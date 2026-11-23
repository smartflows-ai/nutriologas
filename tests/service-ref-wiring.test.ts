// tests/service-ref-wiring.test.ts
// Ticket #140: availability and book resolve the service with resolveServiceRef over the active services of the
// business, answer a list when it is not found, and say which service they resolved. Reads the source (no database).
// Run with: npx tsx --test tests/service-ref-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8");
const AVAILABILITY = read("src/app/api/internal/bot/availability/route.ts");
const BOOK = read("src/app/api/internal/bot/book/route.ts");

const LOOKUP = read("src/lib/service-ref-data.ts");

for (const [name, source] of [["availability", AVAILABILITY], ["book", BOOK]] as const) {
  test(`bot/${name} finds the service through the shared lookup, not with an exact-id query of its own`, () => {
    assert.match(source, /findServiceForBot\(bot,/);
    assert.doesNotMatch(source, /prisma\.product\.find(First|Many)\(/);
  });

  test(`bot/${name} answers the list of services when it cannot resolve, not a bare not found`, () => {
    assert.match(source, /serviceNotFoundBody\(/);
    assert.doesNotMatch(source, /"Servicio no encontrado"/);
    assert.match(source, /status: 404/);
  });

  test(`bot/${name} says which service it resolved and how`, () => {
    assert.match(source, /serviceName: product\.name/);
    assert.match(source, /resolvedVia: /);
    assert.match(source, /productId: product\.id/);
  });
}

test("the lookup tries the exact id over the whole catalog first, with no limit, and only then the tolerant search", () => {
  const exactAt = LOOKUP.indexOf("prisma.product.findFirst(");
  const tolerantAt = LOOKUP.indexOf("prisma.product.findMany(");
  assert.ok(exactAt > 0 && tolerantAt > 0, "both searches exist");
  assert.ok(exactAt < tolerantAt, "the exact id comes first, as before this change");
  const exactCall = LOOKUP.slice(exactAt, tolerantAt);
  assert.match(exactCall, /id: input\.productId/);
  assert.doesNotMatch(exactCall, /take:/, "a business with a large catalog still finds any service by its exact id");
});

test("both searches are limited to the active services of the business, and only the tolerant one has a limit", () => {
  assert.equal((LOOKUP.match(/tenantId: bot\.tenantId, isActive: true, deletedAt: null/g) ?? []).length, 2);
  assert.match(LOOKUP, /take: TOLERANT_SEARCH_LIMIT/);
});

test("bot/book makes the success explicit", () => {
  assert.match(BOOK, /confirmed: true/);
});

test("both routes accept the service name as a way to name the service", () => {
  assert.match(AVAILABILITY, /serviceName/);
  assert.match(BOOK, /serviceName/);
});
