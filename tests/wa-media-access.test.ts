// tests/wa-media-access.test.ts
// Ticket #182, plan R8 and R9: who gets a link to a file, and what the link says. The decision is pure: the route
// loads the row scoped to the session's business and asks this. Run with: npx tsx --test tests/wa-media-access.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { decideMediaLink } from "../src/lib/wa-media-access";
import type { MediaForLink } from "../src/lib/wa-media-data";

const TENANT = "0b6f1a52-6a7e-4f43-9d55-1c1f0e7a9a11";
const OTHER = "7d2c9e10-3b4a-4c5d-8e6f-a1b2c3d4e5f6";
const ID = "5e8f2a10-9c3b-4d7e-8f61-2a3b4c5d6e7f";
const NOW = new Date("2026-12-10T12:00:00Z");

function row(overrides: Partial<MediaForLink> = {}): MediaForLink {
  return {
    id: ID,
    kind: "DOCUMENT",
    status: "STORED",
    fileName: 'Resultados "lab";\r\n.pdf',
    mimeType: "application/pdf",
    storagePath: `${TENANT}/${ID}`,
    destroyAfter: new Date("2026-12-31T12:00:00Z"),
    destroyedAt: null,
    hiddenAt: null,
    ...overrides,
  };
}

test("another business's id and an invented one get the same answer: not found", () => {
  // The route loads the row with the session's business, so another business's row arrives as null.
  assert.deepEqual(decideMediaLink(null, TENANT, NOW, "archivo"), { ok: false, error: "not_found" });
});

test("a stored path that is not <session business>/<id> is never signed", () => {
  assert.deepEqual(decideMediaLink(row({ storagePath: `${OTHER}/${ID}` }), TENANT, NOW, "archivo"), { ok: false, error: "not_found" });
  assert.deepEqual(decideMediaLink(row({ storagePath: `${TENANT}/${OTHER}` }), TENANT, NOW, "archivo"), { ok: false, error: "not_found" });
  assert.deepEqual(decideMediaLink(row({ storagePath: null }), TENANT, NOW, "archivo"), { ok: false, error: "not_available" });
});

test("a hidden, destroyed, expired or never-stored file gives no link", () => {
  for (const changed of [
    { hiddenAt: new Date("2026-12-05T00:00:00Z") },
    { destroyedAt: new Date("2026-12-09T00:00:00Z") },
    { destroyAfter: NOW },
    { status: "PENDING" as const },
    { status: "TOO_LARGE" as const },
    { status: "VIEW_ONCE" as const },
  ]) {
    assert.deepEqual(decideMediaLink(row(changed), TENANT, NOW, "archivo"), { ok: false, error: "not_available" }, JSON.stringify(changed));
  }
});

test("a PDF document opens in a tab with its cleaned name; the type is the one the app read", () => {
  const decision = decideMediaLink(row(), TENANT, NOW, "archivo");
  assert.deepEqual(decision, {
    ok: true,
    path: `${TENANT}/${ID}`,
    mode: "pdf-tab",
    options: {
      contentDisposition: `inline; filename="Resultados lab .pdf"; filename*=UTF-8''Resultados%20lab%20.pdf`,
      contentType: "application/pdf",
    },
  });
});

test("any other document is a download as a generic binary, whatever it is inside", () => {
  const decision = decideMediaLink(row({ fileName: "nota.mp3", mimeType: "audio/mpeg" }), TENANT, NOW, "file");
  assert.equal(decision.ok && decision.mode, "download");
  assert.deepEqual(decision.ok && decision.options, {
    contentDisposition: `attachment; filename="nota.mp3"; filename*=UTF-8''nota.mp3`,
    contentType: "application/octet-stream",
  });
  const unnamed = decideMediaLink(row({ fileName: null, mimeType: null }), TENANT, NOW, "file");
  assert.equal(unnamed.ok && unnamed.options.contentDisposition, `attachment; filename="file"; filename*=UTF-8''file`);
});

test("a photo, audio or video of a safe type plays inline with no name forced", () => {
  const photo = decideMediaLink(row({ kind: "IMAGE", mimeType: "image/jpeg", fileName: null }), TENANT, NOW, "archivo");
  assert.deepEqual(photo, { ok: true, path: `${TENANT}/${ID}`, mode: "image", options: {} });
  const audio = decideMediaLink(row({ kind: "AUDIO", mimeType: "audio/ogg", fileName: null }), TENANT, NOW, "archivo");
  assert.equal(audio.ok && audio.mode, "audio");
});

test("a photo whose bytes are not a safe image is a download, never shown", () => {
  const decision = decideMediaLink(row({ kind: "IMAGE", mimeType: null, fileName: null }), TENANT, NOW, "archivo");
  assert.equal(decision.ok && decision.mode, "download");
  assert.equal(decision.ok && decision.options.contentType, "application/octet-stream");
});
