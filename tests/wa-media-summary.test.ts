// tests/wa-media-summary.test.ts
// Ticket #182: the summary each chat message carries for its file. Pure (src/lib/wa-media-summary.ts).
// Run with: npx tsx --test tests/wa-media-summary.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { summaryOf, type SummaryRow } from "../src/lib/wa-media-summary";

const NOW = new Date("2026-12-10T12:00:00Z");

function row(overrides: Partial<SummaryRow> = {}): SummaryRow {
  return {
    id: "m1",
    messageId: "msg1",
    kind: "IMAGE",
    status: "STORED",
    fileName: null,
    caption: null,
    sizeBytes: BigInt(2048),
    mimeType: "image/jpeg",
    destroyAfter: new Date("2026-12-31T12:00:00Z"),
    destroyedAt: null,
    hiddenAt: null,
    hiddenBy: null,
    ...overrides,
  };
}

test("a stored copy before its date can be opened, with its size as a number", () => {
  const s = summaryOf(row(), NOW);
  assert.equal(s.available, true);
  assert.equal(s.displayMode, "image");
  assert.equal(s.sizeBytes, 2048);
  assert.equal(typeof s.sizeBytes, "number");
});

test("a stored copy past its date, not yet destroyed by the job, already reads as no longer available", () => {
  const s = summaryOf(row({ destroyAfter: NOW }), NOW);
  assert.equal(s.status, "DESTROYED");
  assert.equal(s.available, false);
  assert.equal(s.displayMode, null);
  assert.equal(s.hidden, null);
});

test("a hidden copy says who hid it and when; it cannot be opened", () => {
  const s = summaryOf(row({ hiddenAt: new Date("2026-12-05T10:00:00Z"), hiddenBy: { name: "Ana" } }), NOW);
  assert.equal(s.available, false);
  assert.deepEqual(s.hidden, { at: "2026-12-05T10:00:00.000Z", byName: "Ana" });
});

test("a destroyed row and a row turned away keep their status and never offer a link", () => {
  assert.equal(summaryOf(row({ status: "DESTROYED", destroyedAt: NOW }), NOW).available, false);
  const tooLarge = summaryOf(row({ status: "TOO_LARGE", sizeBytes: BigInt(40_000_000) }), NOW);
  assert.equal(tooLarge.status, "TOO_LARGE");
  assert.equal(tooLarge.sizeBytes, 40_000_000);
  assert.equal(tooLarge.displayMode, null);
});
