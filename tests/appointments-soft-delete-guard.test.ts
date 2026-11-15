// tests/appointments-soft-delete-guard.test.ts
// Ticket #103 (D3c): a deleted visit is hidden by a `deletedAt: null` filter written in every appointment query.
// This test reads src/ and fails when a query forgets the filter, when raw SQL on "appointments" forgets it, or when
// code erases a visit for real. A query that must see deleted visits carries the marker comment
//   // soft-delete: includes deleted (<why>)
// on one of the three lines above it.
// Run with: npx tsx --test tests/appointments-soft-delete-guard.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "..", "src");
const MARKER = "soft-delete: includes deleted";
const READS = /\.appointment\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|count|groupBy|aggregate|updateMany)\(/g;
const HARD_DELETE = /\.appointment\.(delete|deleteMany)\(/g;
const RAW_FROM = /FROM\s+"appointments"/g;

interface SourceFile {
  readonly rel: string;
  readonly text: string;
}

function sourceFiles(dir: string): SourceFile[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(name)) return [];
    return [{ rel: path.relative(SRC, full), text: readFileSync(full, "utf8") }];
  });
}

// The call's own text: from the opening parenthesis to its matching close.
function callText(text: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") depth--;
    if (depth === 0) return text.slice(openIndex, i + 1);
  }
  return text.slice(openIndex);
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function hasMarkerAbove(text: string, index: number): boolean {
  const lines = text.slice(0, index).split("\n");
  return lines.slice(-4).some((l) => l.includes(MARKER));
}

const FILES = sourceFiles(SRC);

test("the scan finds the appointment queries (sanity check)", () => {
  const total = FILES.reduce((n, f) => n + Array.from(f.text.matchAll(READS)).length, 0);
  assert.ok(total >= 25, `expected at least 25 appointment reads in src/, found ${total}`);
});

test("every appointment read filters deletedAt or is marked as including deleted visits", () => {
  const missing = FILES.flatMap((f) =>
    Array.from(f.text.matchAll(READS))
      .filter((m) => {
        const open = (m.index ?? 0) + m[0].length - 1;
        return !callText(f.text, open).includes("deletedAt") && !hasMarkerAbove(f.text, m.index ?? 0);
      })
      .map((m) => `${f.rel}:${lineOf(f.text, m.index ?? 0)} ${m[0]}`)
  );
  assert.deepEqual(missing, [], `add deletedAt: null (or the marker) to:\n${missing.join("\n")}`);
});

test("raw SQL on appointments filters deletedAt", () => {
  const missing = FILES.flatMap((f) =>
    Array.from(f.text.matchAll(RAW_FROM))
      .filter((m) => {
        const after = f.text.slice(m.index ?? 0, (m.index ?? 0) + 400);
        return !after.includes('"deletedAt" IS NULL') && !hasMarkerAbove(f.text, m.index ?? 0);
      })
      .map((m) => `${f.rel}:${lineOf(f.text, m.index ?? 0)}`)
  );
  assert.deepEqual(missing, [], `add "deletedAt" IS NULL to:\n${missing.join("\n")}`);
});

test("no code erases a visit for real", () => {
  const found = FILES.flatMap((f) =>
    Array.from(f.text.matchAll(HARD_DELETE)).map((m) => `${f.rel}:${lineOf(f.text, m.index ?? 0)} ${m[0]}`)
  );
  assert.deepEqual(found, [], `use the soft delete instead of:\n${found.join("\n")}`);
});
