// tests/wa-media-origin.test.ts
// Ticket #182: the real origin of a file is the WhatsApp line of the row's own business. It describes a message by its
// key (size, type, view once) BEFORE anything is downloaded, and downloads by the key alone. The connection reads are
// injected: no network, no database.
// Run with: npx tsx --test tests/wa-media-origin.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createMediaOrigin, type OriginDeps, type OriginLine } from "../src/lib/wa-media-origin";
import type { MediaRef } from "../src/lib/wa-media-ingest";
import type { EvolutionResult, MediaByKeyResult } from "../src/lib/messaging/evolution-adapter";

const TENANT = "0b6f1a52-6a7e-4f43-9d55-1c1f0e7a9a11";
const OTHER = "7d2c9e10-3b4a-4c5d-8e6f-a1b2c3d4e5f6";
const REF: MediaRef = { tenantId: TENANT, keyId: "ABC", remoteJid: "contact@s.whatsapp.net", fromMe: false };
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);

const LINES: Record<string, OriginLine> = {
  [TENANT]: { instance: `newy-${TENANT}`, apiKey: "KEY-A" },
  [OTHER]: { instance: `otro-${OTHER}`, apiKey: "KEY-B" },
};

function photoRecord(overrides: { id?: string; fromMe?: boolean; message?: unknown } = {}) {
  return {
    key: { id: overrides.id ?? "ABC", fromMe: overrides.fromMe ?? false, remoteJid: "contact@s.whatsapp.net" },
    messageType: "imageMessage",
    message: overrides.message ?? { imageMessage: { fileLength: "45362", mimetype: "image/jpeg", caption: "estudio" } },
  };
}

function setup(options: {
  lines?: Record<string, OriginLine>;
  records?: EvolutionResult<Record<string, unknown>[]>;
  file?: MediaByKeyResult;
} = {}) {
  const calls: string[] = [];
  const signals: Array<AbortSignal | undefined> = [];
  const deps: OriginDeps = {
    async lineOf(tenantId) {
      calls.push(`line:${tenantId}`);
      return (options.lines ?? LINES)[tenantId] ?? null;
    },
    async findByKey(line, keyId, signal) {
      calls.push(`find:${line.instance}:${line.apiKey}:${keyId}`);
      signals.push(signal);
      return options.records ?? { ok: true, status: 200, data: [photoRecord()] };
    },
    async fileByKey(line, key, signal) {
      calls.push(`file:${line.instance}:${line.apiKey}:${key.id}:${key.remoteJid}:${key.fromMe}`);
      signals.push(signal);
      return options.file ?? { ok: true, status: 201, data: JPEG };
    },
  };
  return { origin: createMediaOrigin(deps), calls, signals };
}

test("describe gives size, type and caption from the connection's record, before anything is downloaded", async () => {
  const { origin, calls } = setup();
  const described = await origin.describe(REF);
  assert.deepEqual(described, {
    ok: true,
    value: { kind: "IMAGE", viewOnce: false, declaredBytes: 45362, declaredMime: "image/jpeg", fileName: null, caption: "estudio" },
  });
  assert.ok(!calls.some((c) => c.startsWith("file:")), "describing never downloads");
});

test("a view-once message is described as view once (the ingest never downloads it)", async () => {
  const message = { viewOnceMessageV2: { message: { imageMessage: { fileLength: "45362", mimetype: "image/jpeg" } } } };
  const { origin } = setup({ records: { ok: true, status: 200, data: [photoRecord({ message })] } });
  const described = await origin.describe(REF);
  assert.equal(described.ok && described.value?.viewOnce, true);
});

test("only the record of that exact key and side counts; anything else is 'not found'", async () => {
  for (const record of [photoRecord({ id: "OTHER" }), photoRecord({ fromMe: true }), { key: {}, message: {} }]) {
    const { origin } = setup({ records: { ok: true, status: 200, data: [record] } });
    assert.deepEqual(await origin.describe(REF), { ok: true, value: null });
  }
  const empty = setup({ records: { ok: true, status: 200, data: [] } });
  assert.deepEqual(await empty.origin.describe(REF), { ok: true, value: null });
});

test("a record without a file is 'not found', never a guessed file", async () => {
  const { origin } = setup({ records: { ok: true, status: 200, data: [photoRecord({ message: { conversation: "hola" } })] } });
  assert.deepEqual(await origin.describe(REF), { ok: true, value: null });
});

test("download asks for the file by its key alone (id, chat, side) on the business's own line", async () => {
  const { origin, calls } = setup();
  const downloaded = await origin.download(REF);
  assert.deepEqual(downloaded, { ok: true, value: JPEG });
  assert.deepEqual(calls, [`line:${TENANT}`, `file:newy-${TENANT}:KEY-A:ABC:contact@s.whatsapp.net:false`]);
});

test("the line is always the row's own business: another business's file goes to its own line and key", async () => {
  const { origin, calls } = setup();
  await origin.download(REF);
  await origin.download({ ...REF, tenantId: OTHER, keyId: "XYZ" });
  assert.ok(calls.includes(`file:newy-${TENANT}:KEY-A:ABC:contact@s.whatsapp.net:false`));
  assert.ok(calls.includes(`file:otro-${OTHER}:KEY-B:XYZ:contact@s.whatsapp.net:false`));
  assert.ok(!calls.some((c) => c.includes(`otro-${OTHER}`) && c.includes(":ABC:")), "never another business's line for this file");
});

test("a business without a connected line gets a short code, and the connection is never called", async () => {
  const { origin, calls } = setup({ lines: {} });
  assert.deepEqual(await origin.describe(REF), { ok: false, error: "no_line" });
  assert.deepEqual(await origin.download(REF), { ok: false, error: "no_line" });
  assert.ok(!calls.some((c) => c.startsWith("find:") || c.startsWith("file:")));
});

test("a connection that is down or slow gives its short code (timeout, network, http)", async () => {
  for (const error of ["timeout", "network", "http"] as const) {
    const down = setup({ records: { ok: false, status: null, error }, file: { ok: false, status: null, error } });
    assert.deepEqual(await down.origin.describe(REF), { ok: false, error });
    assert.deepEqual(await down.origin.download(REF), { ok: false, error });
  }
});

test("the caller's deadline reaches both reads", async () => {
  const controller = new AbortController();
  const { origin, signals } = setup();
  await origin.describe(REF, controller.signal);
  await origin.download(REF, controller.signal);
  assert.deepEqual(signals, [controller.signal, controller.signal]);
});

test("the line of a business is looked up once per origin, not once per file", async () => {
  const { origin, calls } = setup();
  await origin.describe(REF);
  await origin.download(REF);
  assert.equal(calls.filter((c) => c === `line:${TENANT}`).length, 1);
});

test("the download limit of the answer is the base64 of 16 MB plus a margin", async () => {
  const { MAX_MEDIA_RESPONSE_BYTES } = await import("../src/lib/wa-media-origin");
  const { MAX_MEDIA_BYTES } = await import("../src/lib/wa-media-rules");
  assert.ok(MAX_MEDIA_RESPONSE_BYTES >= Math.ceil(MAX_MEDIA_BYTES / 3) * 4);
  assert.ok(MAX_MEDIA_RESPONSE_BYTES <= Math.ceil(MAX_MEDIA_BYTES / 3) * 4 + 1024 * 1024);
});

test("a too-large answer reaches the ingest as its own short code", async () => {
  const { origin } = setup({ file: { ok: false, status: 201, error: "too_large" } });
  assert.deepEqual(await origin.download(REF), { ok: false, error: "too_large" });
});
