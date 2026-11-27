// tests/wa-media-view.test.ts
// Ticket #182, screen: what the chat bubble shows for each file state, decided without a browser.
// Run with: npx tsx --test tests/wa-media-view.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { bubbleTextOf, hiddenDateLabel, mediaViewOf, nextMediaSrc, sizeLabel } from "../src/components/admin/whatsapp/media/media-view";
import type { MediaSummary } from "../src/lib/wa-media-summary";

function summary(overrides: Partial<MediaSummary> = {}): MediaSummary {
  return {
    id: "m1",
    messageId: "msg1",
    kind: "IMAGE",
    status: "STORED",
    fileName: null,
    caption: null,
    sizeBytes: 2048,
    displayMode: "image",
    available: true,
    hidden: null,
    ...overrides,
  };
}

test("a stored file that can be opened is shown by its display mode", () => {
  assert.deepEqual(mediaViewOf(summary()), { kind: "content", mode: "image" });
  assert.deepEqual(mediaViewOf(summary({ kind: "DOCUMENT", displayMode: "pdf-tab" })), { kind: "content", mode: "pdf-tab" });
  assert.deepEqual(mediaViewOf(summary({ kind: "DOCUMENT", displayMode: "download" })), { kind: "content", mode: "download" });
});

test("a hidden file shows who removed it, with Restore", () => {
  const hidden = { at: "2026-12-05T10:00:00.000Z", byName: "Ana" };
  assert.deepEqual(mediaViewOf(summary({ available: false, hidden })), { kind: "hidden", hidden });
});

test("every state that is not a stored copy has its own notice", () => {
  const cases: Array<[Partial<MediaSummary>, string]> = [
    [{ status: "RECEIVED" }, "saving"],
    [{ status: "PENDING" }, "saving"],
    [{ status: "TOO_LARGE" }, "tooLarge"],
    [{ status: "SIZE_UNKNOWN" }, "sizeUnknown"],
    [{ status: "CONTACT_LIMIT" }, "contactLimit"],
    [{ status: "TENANT_LIMIT" }, "tenantLimit"],
    [{ status: "PLATFORM_LIMIT" }, "platformLimit"],
    [{ status: "FAILED" }, "failed"],
    [{ status: "DESTROYED" }, "unavailable"],
    [{ status: "STORED", available: false, displayMode: null }, "unavailable"],
    [{ status: "VIEW_ONCE", kind: "IMAGE" }, "viewOnceImage"],
    [{ status: "VIEW_ONCE", kind: "VIDEO" }, "viewOnceVideo"],
    [{ status: "VIEW_ONCE", kind: "AUDIO" }, "viewOnceAudio"],
  ];
  for (const [changed, notice] of cases) {
    const view = mediaViewOf(summary({ available: false, displayMode: null, ...changed }));
    assert.deepEqual(view, { kind: "notice", notice }, JSON.stringify(changed));
  }
});

test("the size reads in KB under 1 MB and in MB with one decimal above; no size, no label", () => {
  const texts = { sizeKb: "{n} KB", sizeMb: "{n} MB" };
  assert.equal(sizeLabel(512, texts), "1 KB");
  assert.equal(sizeLabel(2048, texts), "2 KB");
  assert.equal(sizeLabel(1_572_864, texts), "1.5 MB");
  assert.equal(sizeLabel(16 * 1024 * 1024, texts), "16 MB");
  assert.equal(sizeLabel(null, texts), null);
  assert.equal(sizeLabel(0, texts), null);
});

// ── Text next to a file ─────────────────────────────────────────────────────

test("a patient's file: the marker is the line, the caption arrives later on the file row and is what shows", () => {
  assert.equal(bubbleTextOf("[Imagen]", summary({ caption: "mi estudio\nde ayer" })), "mi estudio\nde ayer");
});

test("a caption already in the line (the business side) shows once", () => {
  assert.equal(bubbleTextOf("mi estudio", summary({ caption: "mi estudio" })), "mi estudio");
  assert.equal(bubbleTextOf("mi estudio", summary({ caption: null })), "mi estudio");
});

test("with a file and no caption, the marker never shows next to the file", () => {
  for (const marker of ["[Imagen]", "[Audio]", "[Video]", "[Documento]", "[Sticker]", "[Foto de una sola vez]", "[Video de una sola vez]", "[Audio de una sola vez]", "[Mensaje Multimedia]"]) {
    assert.equal(bubbleTextOf(marker, summary({ caption: null })), null, marker);
  }
});

test("without a file the line is shown as it is, a marker included", () => {
  assert.equal(bubbleTextOf("[Imagen]", null), "[Imagen]");
  assert.equal(bubbleTextOf("hola", null), "hola");
});

// ── A renewed link never interrupts ─────────────────────────────────────────

test("the first link is always applied", () => {
  for (const mode of ["image", "audio", "video", "download", "pdf-tab"] as const) {
    assert.equal(nextMediaSrc(mode, null, "u1", { playing: false, errored: false }), "u1", mode);
  }
});

test("a renewed link waits while an audio or video is playing, and is applied once paused, ended or broken", () => {
  assert.equal(nextMediaSrc("audio", "u1", "u2", { playing: true, errored: false }), "u1");
  assert.equal(nextMediaSrc("video", "u1", "u2", { playing: true, errored: false }), "u1");
  assert.equal(nextMediaSrc("audio", "u1", "u2", { playing: false, errored: false }), "u2");
  assert.equal(nextMediaSrc("video", "u1", "u2", { playing: true, errored: true }), "u2");
});

test("a photo already shown keeps its link unless it breaks; documents always take the newest link", () => {
  assert.equal(nextMediaSrc("image", "u1", "u2", { playing: false, errored: false }), "u1");
  assert.equal(nextMediaSrc("image", "u1", "u2", { playing: false, errored: true }), "u2");
  assert.equal(nextMediaSrc("download", "u1", "u2", { playing: false, errored: false }), "u2");
  assert.equal(nextMediaSrc("pdf-tab", "u1", "u2", { playing: false, errored: false }), "u2");
});

// ── Screen wiring (reads the source) ────────────────────────────────────────

const source = (rel: string) => readFileSync(path.join(__dirname, "..", rel), "utf8");

test("the chat page shows the text through bubbleTextOf, never the raw line next to a file", () => {
  const page = source("src/app/admin/whatsapp/page.tsx");
  assert.match(page, /<MediaBubble media=\{msg\.media\}/);
  assert.match(page, /parseWhatsAppToMarkdown\(bubbleTextOf\(msg\.content, msg\.media \?\? null\)/);
  assert.doesNotMatch(page, /parseWhatsAppToMarkdown\(msg\.content\)/);
});

test("the full photo view moves the focus to Close when it opens and back to the thumbnail when it closes", () => {
  const image = source("src/components/admin/whatsapp/media/MediaImage.tsx");
  assert.match(image, /closeButton\.current\?\.focus\(\)/);
  assert.match(image, /thumbnail\.current\?\.focus\(\)/);
  assert.match(image, /event\.key === "Escape"/);
});

test("photo, audio and video take their link through useAppliedSrc, so a renewal never cuts playback", () => {
  const bubble = source("src/components/admin/whatsapp/media/MediaBubble.tsx");
  assert.match(bubble, /useAppliedSrc\(mode, latest, reload\)/);
  assert.match(bubble, /onEnded: onPause/);
  assert.doesNotMatch(bubble, /src=\{state\.url\}/);
});

// ── "Removed by … on <date>": the date follows the panel language, not the browser's ──

test("the removal date reads in the panel language", () => {
  const at = "2026-11-26T15:00:00.000Z";
  const es = hiddenDateLabel(at, "es");
  assert.match(es, /26/);
  assert.match(es, /nov/i);
  assert.match(es, /2026/);
  assert.doesNotMatch(es, /Nov 26,/, "never the English order inside a Spanish panel");
  assert.equal(hiddenDateLabel(at, "en"), "Nov 26, 2026");
});

test("the hidden notice formats its date with the panel language", () => {
  const notice = source("src/components/admin/whatsapp/media/MediaNotice.tsx");
  assert.match(notice, /hiddenDateLabel\(hidden\.at, lang\)/);
  assert.doesNotMatch(notice, /toLocaleDateString\(undefined/);
});
