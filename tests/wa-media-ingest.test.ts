// tests/wa-media-ingest.test.ts
// Ticket #182: one file row goes from "received" to stored (or to the reason it is not), with the origin of the file,
// the store and the database injected: no network, no database. Plan R1 to R7.
// Run with: npx tsx --test tests/wa-media-ingest.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { ingestMedia, type IngestDeps, type IngestRow, type MediaOrigin } from "../src/lib/wa-media-ingest";
import { MAX_MEDIA_ATTEMPTS, MAX_MEDIA_BYTES, type Admission, type MediaInfo } from "../src/lib/wa-media-rules";
import type { MediaStore } from "../src/lib/wa-media-storage";

const TENANT = "0b6f1a52-6a7e-4f43-9d55-1c1f0e7a9a11";
const MEDIA = "5e8f2a10-9c3b-4d7e-8f61-2a3b4c5d6e7f";
const NOW = new Date("2026-12-01T18:00:00Z");
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const HTML = Uint8Array.from(Array.from("<!doctype html>", (c) => c.charCodeAt(0)));

const PHOTO: MediaInfo = { kind: "IMAGE", viewOnce: false, declaredBytes: 8, declaredMime: "image/jpeg", fileName: null, caption: "mi estudio" };

function baseRow(overrides: Partial<IngestRow> = {}): IngestRow {
  return {
    id: MEDIA,
    tenantId: TENANT,
    keyId: "ABC",
    remoteJid: "contact@s.whatsapp.net",
    fromMe: false,
    kind: "IMAGE",
    status: "RECEIVED",
    attempts: 0,
    destroyedAt: null,
    ...overrides,
  };
}

interface World {
  deps: IngestDeps;
  calls: string[];
  row: IngestRow;
  stored: Array<{ path: string; contentType: string; bytes: number }>;
}

function world(options: {
  row?: Partial<IngestRow>;
  describe?: Awaited<ReturnType<MediaOrigin["describe"]>>;
  download?: Awaited<ReturnType<MediaOrigin["download"]>>;
  verdict?: Admission;
  origin?: boolean;
  storeConfigured?: boolean;
  putFails?: boolean;
} = {}): World {
  const calls: string[] = [];
  const stored: World["stored"] = [];
  const state: World = { deps: undefined as unknown as IngestDeps, calls, row: baseRow(options.row), stored };
  const origin: MediaOrigin = {
    async describe() {
      calls.push("describe");
      return options.describe ?? { ok: true, value: PHOTO };
    },
    async download() {
      calls.push("download");
      return options.download ?? { ok: true, value: JPEG };
    },
  };
  const store: MediaStore = {
    async put(path, body, opts) {
      calls.push("put");
      if (options.putFails) return { ok: false, error: "store_failed" };
      stored.push({ path, contentType: opts.contentType, bytes: body.byteLength });
      return { ok: true, value: undefined };
    },
    async signedUrl() {
      return { ok: false, error: "not_configured" };
    },
    async remove() {
      return { ok: true, value: undefined };
    },
  };
  state.deps = {
    origin: options.origin === false ? null : origin,
    store,
    storeConfigured: options.storeConfigured ?? true,
    now: () => NOW,
    async loadRow() {
      calls.push("load");
      return state.row;
    },
    async admit(_id, info) {
      calls.push(`admit:${info.kind}:${info.viewOnce}`);
      const verdict = options.verdict ?? (info.viewOnce ? "VIEW_ONCE" : "PENDING");
      state.row = { ...state.row, status: verdict };
      return verdict;
    },
    async markStored(_id, result) {
      calls.push(`stored:${result.mimeType}:${result.sizeBytes}`);
      state.row = { ...state.row, status: "STORED" };
    },
    async markTooLarge(_id, sizeBytes) {
      calls.push(`too_large:${sizeBytes}`);
      state.row = { ...state.row, status: "TOO_LARGE" };
    },
    async markAttemptFailed(_id, reason, finalStatus) {
      calls.push(`failed:${reason}:${finalStatus ?? "retry"}`);
      state.row = { ...state.row, attempts: state.row.attempts + 1, ...(finalStatus ? { status: finalStatus } : {}) };
    },
  };
  return state;
}

test("a received patient file is described with the full message, let in, downloaded and stored", async () => {
  const w = world();
  assert.equal(await ingestMedia(w.deps, MEDIA), "stored");
  assert.deepEqual(w.calls, ["load", "describe", "admit:IMAGE:false", "download", "put", "stored:image/jpeg:8"]);
  assert.deepEqual(w.stored, [{ path: `${TENANT}/${MEDIA}`, contentType: "image/jpeg", bytes: 8 }]);
});

test("without an origin nothing is attempted and no attempt is used", async () => {
  const w = world({ origin: false });
  assert.equal(await ingestMedia(w.deps, MEDIA), "no_origin");
  assert.deepEqual(w.calls, ["load"]);
  assert.equal(w.row.attempts, 0);
});

test("without a configured store nothing is attempted and no attempt is used", async () => {
  const w = world({ storeConfigured: false });
  assert.equal(await ingestMedia(w.deps, MEDIA), "no_store");
  assert.deepEqual(w.calls, ["load"]);
});

test("view once (known only from the full message) is never downloaded", async () => {
  const w = world({ describe: { ok: true, value: { ...PHOTO, viewOnce: true } } });
  assert.equal(await ingestMedia(w.deps, MEDIA), "VIEW_ONCE");
  assert.ok(!w.calls.includes("download"));
  assert.ok(!w.calls.includes("put"));
});

test("a file turned away by admission is never downloaded", async () => {
  for (const verdict of ["TOO_LARGE", "SIZE_UNKNOWN", "CONTACT_LIMIT", "TENANT_LIMIT", "PLATFORM_LIMIT"] as Admission[]) {
    const w = world({ verdict });
    assert.equal(await ingestMedia(w.deps, MEDIA), verdict);
    assert.ok(!w.calls.includes("download"), verdict);
  }
});

test("a pending row (already let in) is downloaded without describing or admitting it again", async () => {
  const w = world({ row: { status: "PENDING" } });
  assert.equal(await ingestMedia(w.deps, MEDIA), "stored");
  assert.deepEqual(w.calls, ["load", "download", "put", "stored:image/jpeg:8"]);
});

test("a stored, rejected or destroyed row is left alone: a retry adds nothing", async () => {
  for (const status of ["STORED", "TOO_LARGE", "VIEW_ONCE", "FAILED", "DESTROYED"] as IngestRow["status"][]) {
    const w = world({ row: { status } });
    assert.equal(await ingestMedia(w.deps, MEDIA), "skipped", status);
    assert.deepEqual(w.calls, ["load"], status);
  }
  const gone = world({ row: { destroyedAt: NOW } });
  assert.equal(await ingestMedia(gone.deps, MEDIA), "skipped");
});

test("a missing row is skipped", async () => {
  const w = world();
  w.deps.loadRow = async () => null;
  assert.equal(await ingestMedia(w.deps, MEDIA), "skipped");
});

test("the stored type is the one read from the bytes: an image that is HTML is stored as a generic binary", async () => {
  const w = world({ download: { ok: true, value: HTML } });
  assert.equal(await ingestMedia(w.deps, MEDIA), "stored");
  assert.equal(w.stored[0].contentType, "application/octet-stream");
  assert.ok(w.calls.includes(`stored:null:${HTML.byteLength}`));
});

test("a download larger than 16 MB is not stored, whatever the message declared", async () => {
  const w = world({ download: { ok: true, value: new Uint8Array(MAX_MEDIA_BYTES + 1) } });
  assert.equal(await ingestMedia(w.deps, MEDIA), "TOO_LARGE");
  assert.ok(!w.calls.includes("put"));
  assert.ok(w.calls.includes(`too_large:${MAX_MEDIA_BYTES + 1}`));
});

test("a failed describe, download or upload uses one attempt and keeps the row for the next run", async () => {
  const describeFails = world({ describe: { ok: false, error: "timeout" } });
  assert.equal(await ingestMedia(describeFails.deps, MEDIA), "retry");
  assert.ok(describeFails.calls.includes("failed:describe_timeout:retry"));
  const downloadFails = world({ row: { status: "PENDING" }, download: { ok: false, error: "http" } });
  assert.equal(await ingestMedia(downloadFails.deps, MEDIA), "retry");
  assert.ok(downloadFails.calls.includes("failed:download_http:retry"));
  const putFails = world({ row: { status: "PENDING" }, putFails: true });
  assert.equal(await ingestMedia(putFails.deps, MEDIA), "retry");
  assert.ok(putFails.calls.includes("failed:store_failed:retry"));
});

test("a message the origin cannot find uses an attempt too: it may still be on its way", async () => {
  const w = world({ describe: { ok: true, value: null } });
  assert.equal(await ingestMedia(w.deps, MEDIA), "retry");
  assert.ok(w.calls.includes("failed:message_not_found:retry"));
});

test("the last attempt closes the row: a pending one as FAILED, one never described as SIZE_UNKNOWN", async () => {
  const pending = world({ row: { status: "PENDING", attempts: MAX_MEDIA_ATTEMPTS - 1 }, download: { ok: false, error: "network" } });
  assert.equal(await ingestMedia(pending.deps, MEDIA), "FAILED");
  assert.ok(pending.calls.includes("failed:download_network:FAILED"));
  const received = world({ row: { attempts: MAX_MEDIA_ATTEMPTS - 1 }, describe: { ok: true, value: null } });
  assert.equal(await ingestMedia(received.deps, MEDIA), "SIZE_UNKNOWN");
  assert.ok(received.calls.includes("failed:message_not_found:SIZE_UNKNOWN"));
});

test("a row that already used every attempt is not tried again", async () => {
  const w = world({ row: { status: "PENDING", attempts: MAX_MEDIA_ATTEMPTS } });
  assert.equal(await ingestMedia(w.deps, MEDIA), "skipped");
  assert.deepEqual(w.calls, ["load"]);
});

test("the failure reasons are short codes, never a provider message", async () => {
  const w = world({ row: { status: "PENDING" }, download: { ok: false, error: "http" } });
  await ingestMedia(w.deps, MEDIA);
  const reason = w.calls.find((c) => c.startsWith("failed:"))?.split(":")[1] ?? "";
  assert.match(reason, /^[a-z_]+$/);
});
