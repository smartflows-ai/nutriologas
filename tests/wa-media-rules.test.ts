// tests/wa-media-rules.test.ts
// Ticket #182: pure rules for WhatsApp files shown in the panel (plan .claude/plans/182-archivos-panel-whatsapp.plan.md,
// rules R1 to R9). No database, no network: the clock and every row are passed in.
// Run with: npx tsx --test tests/wa-media-rules.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MEDIA_BYTES,
  MAX_MEDIA_PER_CONTACT_PER_DAY,
  MAX_TENANT_MEDIA_BYTES,
  MEDIA_RETENTION_DAYS,
  admitMedia,
  contactCountOn,
  contactDayWindow,
  countsTowardContactLimit,
  destroyAfterOf,
  destroyedPatch,
  destructionRequestPatch,
  displayModeOf,
  hidePatch,
  isDueForDestruction,
  needsStoreRemoval,
  isMediaEnabledFor,
  isPathOfTenant,
  mediaOf,
  mediaStoragePath,
  parseDeclaredBytes,
  restorePatch,
  sniffMime,
  tenantBytesInUse,
  type MediaRow,
  type MediaStatus,
} from "../src/lib/wa-media-rules";

const TENANT = "0b6f1a52-6a7e-4f43-9d55-1c1f0e7a9a11";
const OTHER_TENANT = "7d2c9e10-3b4a-4c5d-8e6f-a1b2c3d4e5f6";
const MEDIA_ID = "5e8f2a10-9c3b-4d7e-8f61-2a3b4c5d6e7f";
const CHAT_A = "chat-a";
const CHAT_B = "chat-b";
const MX = "America/Mexico_City";
const MADRID = "Europe/Madrid";
const DAY_MS = 24 * 60 * 60 * 1000;

function row(overrides: Partial<MediaRow> = {}): MediaRow {
  return {
    chatId: CHAT_A,
    fromMe: false,
    status: "STORED",
    sizeBytes: 1_000,
    receivedAt: new Date("2026-12-01T18:00:00Z"),
    destroyAfter: new Date("2026-12-31T18:00:00Z"),
    destroyRequestedAt: null,
    destroyedAt: null,
    hiddenAt: null,
    ...overrides,
  };
}

function admit(overrides: Partial<Parameters<typeof admitMedia>[0]> = {}) {
  return admitMedia({
    viewOnce: false,
    declaredBytes: 1_000,
    fromMe: false,
    contactCountToday: 0,
    tenantBytesInUse: 0,
    ...overrides,
  });
}

// ── Limits are named constants ──────────────────────────────────────────────

test("the limits are the owner's decisions", () => {
  assert.equal(MAX_MEDIA_BYTES, 16 * 1024 * 1024);
  assert.equal(MAX_MEDIA_PER_CONTACT_PER_DAY, 30);
  assert.equal(MAX_TENANT_MEDIA_BYTES, 2 * 1024 * 1024 * 1024);
  assert.equal(MEDIA_RETENTION_DAYS, 30);
});

// ── R1: what kind of file, read from the shape of the message ───────────────

test("the kind comes from the shape of the message, also when the workflow sends only the type key", () => {
  assert.equal(mediaOf({ imageMessage: {} })?.kind, "IMAGE");
  assert.equal(mediaOf({ audioMessage: {} })?.kind, "AUDIO");
  assert.equal(mediaOf({ videoMessage: {} })?.kind, "VIDEO");
  assert.equal(mediaOf({ ptvMessage: {} })?.kind, "VIDEO");
  assert.equal(mediaOf({ documentMessage: {} })?.kind, "DOCUMENT");
  assert.equal(mediaOf({ documentWithCaptionMessage: { message: { documentMessage: {} } } })?.kind, "DOCUMENT");
  assert.equal(mediaOf({ stickerMessage: {} })?.kind, "STICKER");
});

test("a message without a file has no media", () => {
  assert.equal(mediaOf({ conversation: "hola" }), null);
  assert.equal(mediaOf({ reactionMessage: { text: "ok" } }), null);
  assert.equal(mediaOf({ locationMessage: {} }), null);
  assert.equal(mediaOf(null), null);
  assert.equal(mediaOf(undefined), null);
});

test("a full message (the business side) gives size, type, name and caption", () => {
  const media = mediaOf({
    documentMessage: { fileLength: "48213", mimetype: "application/pdf", fileName: "estudio.pdf", caption: "mi estudio" },
  });
  assert.deepEqual(media, {
    kind: "DOCUMENT",
    viewOnce: false,
    declaredBytes: 48_213,
    declaredMime: "application/pdf",
    fileName: "estudio.pdf",
    caption: "mi estudio",
  });
});

test("the document caption is read in both shapes", () => {
  assert.equal(mediaOf({ documentMessage: { caption: "a" } })?.caption, "a");
  assert.equal(mediaOf({ documentWithCaptionMessage: { message: { documentMessage: { caption: "b" } } } })?.caption, "b");
});

// ── R7: view once, recognized by the shape ──────────────────────────────────

test("view once is recognized by its three outer keys and by the flag on the media", () => {
  for (const outer of ["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension"]) {
    const media = mediaOf({ [outer]: { message: { imageMessage: {} } } });
    assert.equal(media?.viewOnce, true, outer);
    assert.equal(media?.kind, "IMAGE", outer);
  }
  assert.equal(mediaOf({ viewOnceMessageV2Extension: { message: { audioMessage: {} } } })?.kind, "AUDIO");
  assert.equal(mediaOf({ imageMessage: { viewOnce: true } })?.viewOnce, true);
  assert.equal(mediaOf({ imageMessage: {} })?.viewOnce, false);
});

test("an empty view-once wrapper is a view-once photo: a row is made, never a downloadable one", () => {
  for (const outer of ["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension"]) {
    const media = mediaOf({ [outer]: {} });
    assert.equal(media?.viewOnce, true, outer);
    assert.equal(media?.kind, "IMAGE", outer);
    assert.equal(admit({ viewOnce: media?.viewOnce ?? false, declaredBytes: media?.declaredBytes ?? null }), "VIEW_ONCE");
  }
});

test("an empty document-with-caption wrapper is a document, the same as its marker", () => {
  assert.equal(mediaOf({ documentWithCaptionMessage: {} })?.kind, "DOCUMENT");
  assert.equal(mediaOf({ documentWithCaptionMessage: {} })?.viewOnce, false);
});

test("view once is never downloaded and never counts toward the contact limit", () => {
  assert.equal(admit({ viewOnce: true }), "VIEW_ONCE");
  assert.equal(admit({ viewOnce: true, declaredBytes: null }), "VIEW_ONCE");
  assert.equal(countsTowardContactLimit("VIEW_ONCE"), false);
});

// ── R2: 16 MB per file, checked before the download ─────────────────────────

test("16 MB exactly is stored and one byte more is too large", () => {
  assert.equal(admit({ declaredBytes: MAX_MEDIA_BYTES }), "PENDING");
  assert.equal(admit({ declaredBytes: MAX_MEDIA_BYTES + 1 }), "TOO_LARGE");
});

test("a missing, zero, negative or non-numeric size is unknown: never downloaded", () => {
  for (const raw of [undefined, null, "", 0, "0", -5, "-5", "abc", Number.NaN, Number.POSITIVE_INFINITY, 1.5, {}]) {
    assert.equal(parseDeclaredBytes(raw), null, `raw ${String(raw)}`);
  }
  assert.equal(admit({ declaredBytes: null }), "SIZE_UNKNOWN");
});

test("the size is read as a number, a numeric text or a 64-bit long", () => {
  assert.equal(parseDeclaredBytes(2_048), 2_048);
  assert.equal(parseDeclaredBytes("2048"), 2_048);
  assert.equal(parseDeclaredBytes({ low: 2_048, high: 0, unsigned: true }), 2_048);
  // 2 GB declared by a document: does not fit a 32-bit integer.
  assert.equal(parseDeclaredBytes({ low: 0, high: 1, unsigned: true }), 4_294_967_296);
  assert.equal(parseDeclaredBytes({ low: -1, high: 0, unsigned: true }), 4_294_967_295);
});

// ── R3: 30 received files per contact per business day ──────────────────────

test("the 30th file of the day is stored and the 31st is not", () => {
  assert.equal(admit({ contactCountToday: 29 }), "PENDING");
  assert.equal(admit({ contactCountToday: 30 }), "CONTACT_LIMIT");
});

test("files the business sends do not count and are not capped by contact", () => {
  assert.equal(admit({ fromMe: true, contactCountToday: 500 }), "PENDING");
  const sent = Array.from({ length: 40 }, () => row({ fromMe: true }));
  assert.equal(contactCountOn(sent, CHAT_A, new Date("2026-12-01T20:00:00Z"), MX), 0);
});

test("only admitted files count: pending, stored, failed and destroyed, hidden included", () => {
  const counted: MediaStatus[] = ["PENDING", "STORED", "FAILED", "DESTROYED"];
  const notCounted: MediaStatus[] = ["TOO_LARGE", "SIZE_UNKNOWN", "CONTACT_LIMIT", "TENANT_LIMIT", "VIEW_ONCE"];
  for (const status of counted) assert.equal(countsTowardContactLimit(status), true, status);
  for (const status of notCounted) assert.equal(countsTowardContactLimit(status), false, status);
  const hidden = [row({ hiddenAt: new Date("2026-12-01T19:00:00Z") })];
  assert.equal(contactCountOn(hidden, CHAT_A, new Date("2026-12-01T20:00:00Z"), MX), 1);
});

test("40 photos, 10 of them over 16 MB: 30 are stored (owner decision of 2026-11-25)", () => {
  const now = new Date("2026-12-01T20:00:00Z");
  const sizes = Array.from({ length: 40 }, (_, i) => (i % 4 === 0 ? MAX_MEDIA_BYTES + 1 : 1_000));
  const rows: MediaRow[] = [];
  for (const declaredBytes of sizes) {
    const status = admit({ declaredBytes, contactCountToday: contactCountOn(rows, CHAT_A, now, MX) });
    rows.push(row({ status, receivedAt: now }));
  }
  assert.equal(rows.filter((r) => r.status === "PENDING").length, 30);
  assert.equal(rows.filter((r) => r.status === "TOO_LARGE").length, 10);
  assert.equal(rows.filter((r) => r.status === "CONTACT_LIMIT").length, 0);
});

test("100 photos in an afternoon: 30 are stored, the rest hit the contact limit", () => {
  const now = new Date("2026-12-01T20:00:00Z");
  const rows: MediaRow[] = [];
  for (let i = 0; i < 100; i += 1) {
    const status = admit({ contactCountToday: contactCountOn(rows, CHAT_A, now, MX) });
    rows.push(row({ status, receivedAt: now }));
  }
  assert.equal(rows.filter((r) => r.status === "PENDING").length, 30);
  assert.equal(rows.filter((r) => r.status === "CONTACT_LIMIT").length, 70);
});

test("the 31st file of ANOTHER contact is stored", () => {
  const now = new Date("2026-12-01T20:00:00Z");
  const full = Array.from({ length: 30 }, () => row({ chatId: CHAT_A, receivedAt: now }));
  assert.equal(admit({ contactCountToday: contactCountOn(full, CHAT_A, now, MX) }), "CONTACT_LIMIT");
  assert.equal(admit({ contactCountToday: contactCountOn(full, CHAT_B, now, MX) }), "PENDING");
});

test("the day is the business day, in its own time zone", () => {
  // 23:30 in Mexico City on 1 Dec is 05:30Z on 2 Dec.
  const lateMx = new Date("2026-12-02T05:30:00Z");
  const { start, end } = contactDayWindow(lateMx, MX);
  assert.equal(start.toISOString(), "2026-12-01T06:00:00.000Z");
  assert.equal(end.toISOString(), "2026-12-02T06:00:00.000Z");
});

test("midnight in a business of another time zone starts a new day for its contacts", () => {
  // Madrid is UTC+1 in December: its midnight of 2 Dec is 23:00Z on 1 Dec.
  const before = new Date("2026-12-01T22:59:00Z");
  const after = new Date("2026-12-01T23:01:00Z");
  const yesterday = Array.from({ length: 30 }, () => row({ receivedAt: before }));
  assert.equal(contactCountOn(yesterday, CHAT_A, before, MADRID), 30);
  assert.equal(contactCountOn(yesterday, CHAT_A, after, MADRID), 0);
  // The same instants in Mexico City are the same day: the limit still applies there.
  assert.equal(contactCountOn(yesterday, CHAT_A, after, MX), 30);
});

test("the day window is right on a day the clock changes", () => {
  // Madrid moves to summer time on 29 Mar 2026: that day lasts 23 hours.
  const { start, end } = contactDayWindow(new Date("2026-03-29T12:00:00Z"), MADRID);
  assert.equal(start.toISOString(), "2026-03-28T23:00:00.000Z");
  assert.equal(end.toISOString(), "2026-03-29T22:00:00.000Z");
});

// ── R4: 2 GB stored per business ────────────────────────────────────────────

test("bytes in use count stored and pending files, hidden ones included, destroyed ones not", () => {
  const rows = [
    row({ status: "STORED", sizeBytes: 100 }),
    row({ status: "STORED", sizeBytes: 200, hiddenAt: new Date("2026-12-02T00:00:00Z") }),
    row({ status: "PENDING", sizeBytes: 300, fromMe: true }),
    row({ status: "DESTROYED", sizeBytes: 5_000 }),
    row({ status: "TOO_LARGE", sizeBytes: 9_999_999_999 }),
    row({ status: "FAILED", sizeBytes: 7_000 }),
  ];
  assert.equal(tenantBytesInUse(rows), 600);
});

test("a file that would pass 2 GB is not stored; one that fits exactly is", () => {
  assert.equal(admit({ tenantBytesInUse: MAX_TENANT_MEDIA_BYTES - 1_000, declaredBytes: 1_000 }), "PENDING");
  assert.equal(admit({ tenantBytesInUse: MAX_TENANT_MEDIA_BYTES - 999, declaredBytes: 1_000 }), "TENANT_LIMIT");
  // The business's own files are capped by the 2 GB too.
  assert.equal(admit({ fromMe: true, tenantBytesInUse: MAX_TENANT_MEDIA_BYTES, declaredBytes: 1 }), "TENANT_LIMIT");
});

test("a tenant-limit rejection does not count toward the contact limit", () => {
  assert.equal(countsTowardContactLimit("TENANT_LIMIT"), false);
});

// ── R5 and R6: fixed destruction date, hide and restore ─────────────────────

test("the destruction date is 30 days after arrival", () => {
  const receivedAt = new Date("2026-12-01T15:00:00Z");
  assert.equal(destroyAfterOf(receivedAt).toISOString(), "2026-12-31T15:00:00.000Z");
  assert.equal(destroyAfterOf(receivedAt).getTime() - receivedAt.getTime(), MEDIA_RETENTION_DAYS * DAY_MS);
});

test("hiding and restoring never move the destruction date", () => {
  const file = row();
  const hidden = { ...file, ...hidePatch("user-1", new Date("2026-12-05T10:00:00Z")) };
  assert.equal(hidden.destroyAfter.getTime(), file.destroyAfter.getTime());
  assert.equal(hidden.hiddenAt?.toISOString(), "2026-12-05T10:00:00.000Z");
  const restored = { ...hidden, ...restorePatch() };
  assert.equal(restored.destroyAfter.getTime(), file.destroyAfter.getTime());
  assert.equal(restored.hiddenAt, null);
  assert.equal("destroyAfter" in hidePatch("u", new Date()), false);
  assert.equal("destroyAfter" in restorePatch(), false);
});

test("a file is due on its 30th day, hidden or not, with an injected clock", () => {
  const file = row({ destroyAfter: new Date("2026-12-31T18:00:00Z") });
  assert.equal(isDueForDestruction(file, new Date("2026-12-31T17:59:59Z")), false);
  assert.equal(isDueForDestruction(file, new Date("2026-12-31T18:00:00Z")), true);
  const hidden = { ...file, hiddenAt: new Date("2026-12-05T00:00:00Z") };
  assert.equal(isDueForDestruction(hidden, new Date("2026-12-31T18:00:00Z")), true);
  assert.equal(isDueForDestruction(hidden, new Date("2026-12-30T18:00:00Z")), false);
});

test("a deleted chat destroys its files before their date: by the explicit mark, or by the lost chat", () => {
  const early = new Date("2026-12-02T00:00:00Z");
  assert.equal(isDueForDestruction(row({ destroyRequestedAt: early }), early), true);
  assert.equal(isDueForDestruction(row({ chatId: null }), early), true);
});

test("a file already destroyed is not due again", () => {
  const done = row({ status: "DESTROYED", destroyedAt: new Date("2026-12-31T18:05:00Z") });
  assert.equal(isDueForDestruction(done, new Date("2027-01-10T00:00:00Z")), false);
  const rejectedDone = row({ status: "TOO_LARGE", destroyedAt: new Date("2026-12-31T18:05:00Z") });
  assert.equal(isDueForDestruction(rejectedDone, new Date("2027-01-10T00:00:00Z")), false);
});

test("asking for destruction clears the person's data: caption and file name", () => {
  const at = new Date("2026-12-02T00:00:00Z");
  assert.deepEqual(destructionRequestPatch(at), { destroyRequestedAt: at, caption: null, fileName: null });
});

test("a destroyed file keeps only kind, size, dates and status", () => {
  const at = new Date("2026-12-31T18:05:00Z");
  assert.deepEqual(destroyedPatch("STORED", at), {
    status: "DESTROYED",
    destroyedAt: at,
    caption: null,
    fileName: null,
    storagePath: null,
  });
  // FAILED keeps its reason too: its copy is removed from the store (an upload whose answer was lost may have
  // left one), but it never counted as stored.
  assert.equal(destroyedPatch("FAILED", at).status, "FAILED");
  assert.equal(destroyedPatch("PENDING", at).status, "DESTROYED");
  // A file that was never stored keeps the reason it was not, and still loses the person's data.
  assert.deepEqual(destroyedPatch("TOO_LARGE", at), {
    status: "TOO_LARGE",
    destroyedAt: at,
    caption: null,
    fileName: null,
    storagePath: null,
  });
});

test("the store is asked to remove a copy for pending, stored and failed files; never for one never sent to it", () => {
  for (const status of ["PENDING", "STORED", "FAILED"] as MediaStatus[]) assert.equal(needsStoreRemoval(status), true, status);
  for (const status of ["TOO_LARGE", "SIZE_UNKNOWN", "CONTACT_LIMIT", "TENANT_LIMIT", "VIEW_ONCE", "DESTROYED"] as MediaStatus[]) {
    assert.equal(needsStoreRemoval(status), false, status);
  }
  // A failed file does not take space in the business's 2 GB: its copy, if any, is an orphan on its way out.
  assert.equal(tenantBytesInUse([row({ status: "FAILED", sizeBytes: 5_000 })]), 0);
});

// ── Storage path: always starts with the business ───────────────────────────

test("the storage path starts with the business and carries no file name or sender data", () => {
  const path = mediaStoragePath(TENANT, MEDIA_ID);
  assert.equal(path, `${TENANT}/${MEDIA_ID}`);
  assert.equal(isPathOfTenant(path, TENANT), true);
  assert.equal(isPathOfTenant(path, OTHER_TENANT), false);
});

test("the storage path refuses anything that is not an id", () => {
  assert.throws(() => mediaStoragePath("", MEDIA_ID));
  assert.throws(() => mediaStoragePath(TENANT, "estudio.pdf"));
  assert.throws(() => mediaStoragePath(TENANT, "../" + MEDIA_ID));
  assert.throws(() => mediaStoragePath(`${TENANT}/x`, MEDIA_ID));
  assert.throws(() => mediaStoragePath(TENANT, "5215512345678@s.whatsapp.net"));
});

test("a path of another shape is never taken as the business's", () => {
  assert.equal(isPathOfTenant(`${TENANT}/../${OTHER_TENANT}/${MEDIA_ID}`, TENANT), false);
  assert.equal(isPathOfTenant(`${TENANT}/${MEDIA_ID}/x`, TENANT), false);
  assert.equal(isPathOfTenant(`${TENANT}`, TENANT), false);
  assert.equal(isPathOfTenant(`${TENANT}x/${MEDIA_ID}`, TENANT), false);
  assert.equal(isPathOfTenant(`${OTHER_TENANT}/${MEDIA_ID}`, ""), false);
});

// ── R9: what is shown inside the chat, decided by the app ───────────────────

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [...ascii("RIFF"), 0x00, 0x00, 0x00, 0x00, ...ascii("WEBP")];
const OGG = [...ascii("OggS"), 0x00, 0x02];
const MP3_ID3 = [...ascii("ID3"), 0x04, 0x00];
const MP4_VIDEO = [0x00, 0x00, 0x00, 0x18, ...ascii("ftypmp42")];
const MP4_AUDIO = [0x00, 0x00, 0x00, 0x18, ...ascii("ftypM4A ")];
const PDF = [...ascii("%PDF-1.7")];
const HTML = [...ascii("<!doctype html><script>")];

function head(bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes);
}

test("the real type is read from the first bytes", () => {
  assert.equal(sniffMime(head(JPEG)), "image/jpeg");
  assert.equal(sniffMime(head(PNG)), "image/png");
  assert.equal(sniffMime(head(WEBP)), "image/webp");
  assert.equal(sniffMime(head(OGG)), "audio/ogg");
  assert.equal(sniffMime(head(MP3_ID3)), "audio/mpeg");
  assert.equal(sniffMime(head(MP4_VIDEO)), "video/mp4");
  assert.equal(sniffMime(head(MP4_AUDIO)), "audio/mp4");
  assert.equal(sniffMime(head(PDF)), "application/pdf");
  assert.equal(sniffMime(head(HTML)), null);
  assert.equal(sniffMime(head([])), null);
});

test("only known video brands of the MP4 family are video: an iPhone photo (HEIC) or a QuickTime file is not", () => {
  assert.equal(sniffMime(head([0x00, 0x00, 0x00, 0x18, ...ascii("ftypisom")])), "video/mp4");
  assert.equal(sniffMime(head([0x00, 0x00, 0x00, 0x18, ...ascii("ftypavc1")])), "video/mp4");
  assert.equal(sniffMime(head([0x00, 0x00, 0x00, 0x18, ...ascii("ftypheic")])), null);
  assert.equal(sniffMime(head([0x00, 0x00, 0x00, 0x14, ...ascii("ftypqt  ")])), null);
  assert.equal(displayModeOf("VIDEO", sniffMime(head([0x00, 0x00, 0x00, 0x18, ...ascii("ftypheic")]))), "download");
});

test("safe kinds are shown inside the chat", () => {
  assert.equal(displayModeOf("IMAGE", "image/jpeg"), "image");
  assert.equal(displayModeOf("IMAGE", "image/png"), "image");
  assert.equal(displayModeOf("STICKER", "image/webp"), "image");
  assert.equal(displayModeOf("AUDIO", "audio/ogg"), "audio");
  assert.equal(displayModeOf("AUDIO", "audio/mp4"), "audio");
  assert.equal(displayModeOf("VIDEO", "video/mp4"), "video");
});

test("a file that says it is an image but is HTML is only offered as a download", () => {
  assert.equal(displayModeOf("IMAGE", sniffMime(head(HTML))), "download");
  assert.equal(displayModeOf("IMAGE", null), "download");
});

test("the kind of message and the real type must agree", () => {
  assert.equal(displayModeOf("IMAGE", "video/mp4"), "download");
  assert.equal(displayModeOf("AUDIO", "image/jpeg"), "download");
  assert.equal(displayModeOf("VIDEO", "audio/ogg"), "download");
});

test("everything that arrives as a document is a download, even audio or video inside; a PDF opens in a new tab", () => {
  assert.equal(displayModeOf("DOCUMENT", "application/pdf"), "pdf-tab");
  assert.equal(displayModeOf("DOCUMENT", "video/mp4"), "download");
  assert.equal(displayModeOf("DOCUMENT", "audio/ogg"), "download");
  assert.equal(displayModeOf("DOCUMENT", "image/jpeg"), "download");
  assert.equal(displayModeOf("DOCUMENT", null), "download");
});

// ── Server switch: on per business ──────────────────────────────────────────

test("the switch lists the businesses that are on; an empty list is off for everyone", () => {
  assert.equal(isMediaEnabledFor(TENANT, undefined), false);
  assert.equal(isMediaEnabledFor(TENANT, ""), false);
  assert.equal(isMediaEnabledFor(TENANT, " , ,"), false);
  assert.equal(isMediaEnabledFor(TENANT, TENANT), true);
  assert.equal(isMediaEnabledFor(TENANT, ` ${OTHER_TENANT} , ${TENANT} `), true);
  assert.equal(isMediaEnabledFor(TENANT, OTHER_TENANT), false);
  assert.equal(isMediaEnabledFor("", ","), false);
  assert.equal(isMediaEnabledFor(TENANT, TENANT.slice(0, 8)), false);
});
