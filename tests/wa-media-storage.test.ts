// tests/wa-media-storage.test.ts
// Ticket #182: the only door to the private file store. Config from the server variables, the type fixed at upload,
// the download name in the 5-minute signed link, and errors that never carry the provider's words. The store client is
// injected, so nothing here reaches the network.
// Run with: npx tsx --test tests/wa-media-storage.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { MAX_MEDIA_BYTES } from "../src/lib/wa-media-rules";
import {
  MAX_DOWNLOAD_NAME_LENGTH,
  SIGNED_URL_SECONDS,
  contentDispositionFor,
  createMediaStore,
  mediaStoreConfigFromEnv,
  mediaStoreFromEnv,
  serverMediaStore,
  safeDownloadName,
  storeOrigin,
  storedContentType,
  type MediaStoreClient,
} from "../src/lib/wa-media-storage";

const TENANT = "0b6f1a52-6a7e-4f43-9d55-1c1f0e7a9a11";
const MEDIA = "5e8f2a10-9c3b-4d7e-8f61-2a3b4c5d6e7f";
const PATH = `${TENANT}/${MEDIA}`;

const FULL_ENV = {
  WA_MEDIA_STORE_ENDPOINT: "https://project.storage.example.co/storage/v1/s3",
  WA_MEDIA_STORE_REGION: "us-east-1",
  WA_MEDIA_STORE_BUCKET: "whatsapp-media-test",
  WA_MEDIA_STORE_ACCESS_KEY_ID: "id",
  WA_MEDIA_STORE_SECRET_ACCESS_KEY: "secret",
};

// ── Config ──────────────────────────────────────────────────────────────────

test("the store is configured only when the five variables are present", () => {
  assert.deepEqual(mediaStoreConfigFromEnv(FULL_ENV), {
    endpoint: FULL_ENV.WA_MEDIA_STORE_ENDPOINT,
    region: "us-east-1",
    bucket: "whatsapp-media-test",
    accessKeyId: "id",
    secretAccessKey: "secret",
  });
  for (const name of Object.keys(FULL_ENV)) {
    assert.equal(mediaStoreConfigFromEnv({ ...FULL_ENV, [name]: "" }), null, name);
    assert.equal(mediaStoreConfigFromEnv({ ...FULL_ENV, [name]: "   " }), null, name);
  }
  assert.equal(mediaStoreConfigFromEnv({}), null);
});

test("the endpoint must be https, or http only on this machine", () => {
  assert.equal(mediaStoreConfigFromEnv({ ...FULL_ENV, WA_MEDIA_STORE_ENDPOINT: "http://store.example.com" }), null);
  assert.equal(mediaStoreConfigFromEnv({ ...FULL_ENV, WA_MEDIA_STORE_ENDPOINT: "not a url" }), null);
  assert.notEqual(mediaStoreConfigFromEnv({ ...FULL_ENV, WA_MEDIA_STORE_ENDPOINT: "http://localhost:9000" }), null);
});

test("the store origin for the page policy is scheme, host and port only", () => {
  assert.equal(storeOrigin("https://project.storage.example.co/storage/v1/s3"), "https://project.storage.example.co");
  assert.equal(storeOrigin("http://localhost:9000/x"), "http://localhost:9000");
  assert.equal(storeOrigin(""), null);
  assert.equal(storeOrigin(undefined), null);
  assert.equal(storeOrigin("javascript:alert(1)"), null);
});

// ── Download name and type, fixed at upload ─────────────────────────────────

test("the download name loses line breaks, quotes, control characters and path signs", () => {
  assert.equal(safeDownloadName("estudio\r\nSet-Cookie: x.pdf"), "estudio Set-Cookie x.pdf");
  assert.equal(safeDownloadName('fotos";borrar.jpg'), "fotos borrar.jpg");
  assert.equal(safeDownloadName("../../etc/passwd"), "etc passwd");
  assert.equal(safeDownloadName("a\u0000b\u007fc\\d.txt"), "a b c d.txt");
  assert.equal(safeDownloadName("Resultados de laboratorio ñandú.pdf"), "Resultados de laboratorio ñandú.pdf");
});

test("an empty or useless name falls back to a neutral one", () => {
  assert.equal(safeDownloadName(null), "archivo");
  assert.equal(safeDownloadName(""), "archivo");
  assert.equal(safeDownloadName('  ";\\/  '), "archivo");
  assert.equal(safeDownloadName(null, "audio"), "audio");
});

test("a long name is cut and keeps its extension", () => {
  const name = safeDownloadName(`${"a".repeat(400)}.pdf`);
  assert.equal(name.length, MAX_DOWNLOAD_NAME_LENGTH);
  assert.ok(name.endsWith(".pdf"));
});

test("documents download with their name; a PDF opens in a tab with its name; media plays inline", () => {
  assert.equal(
    contentDispositionFor("download", 'Mi "reporte"; final.docx'),
    `attachment; filename="Mi reporte final.docx"; filename*=UTF-8''Mi%20reporte%20final.docx`,
  );
  assert.equal(
    contentDispositionFor("pdf-tab", "Análisis ñ.pdf"),
    `inline; filename="An_lisis _.pdf"; filename*=UTF-8''An%C3%A1lisis%20%C3%B1.pdf`,
  );
  assert.equal(contentDispositionFor("image", "foto.jpg"), "inline");
  assert.equal(contentDispositionFor("audio", null), "inline");
  assert.equal(contentDispositionFor("video", "x"), "inline");
});

test("the encoded name escapes the signs that would break the header", () => {
  // Quotes and stars are already removed by safeDownloadName; parentheses and "!" survive and must be escaped.
  const header = contentDispositionFor("download", "a'b(c)d*e!.txt");
  assert.ok(header.endsWith("filename*=UTF-8''a%20b%28c%29d%20e%21.txt"), header);
  assert.ok(!/[\r\n]/.test(contentDispositionFor("download", "x\r\ny.txt")));
});

test("the stored type is the one the app read, or a generic binary type", () => {
  assert.equal(storedContentType("image/jpeg"), "image/jpeg");
  assert.equal(storedContentType(null), "application/octet-stream");
});

// ── Operations, with the client injected ────────────────────────────────────

interface Call {
  op: string;
  input: Record<string, unknown>;
}

function fakeClient(fail?: { op: string; error: Error }): { client: MediaStoreClient; calls: Call[] } {
  const calls: Call[] = [];
  const client: MediaStoreClient = {
    async put(input) {
      calls.push({ op: "put", input: { ...input } });
      if (fail?.op === "put") throw fail.error;
    },
    async remove(input) {
      calls.push({ op: "remove", input: { ...input } });
      if (fail?.op === "remove") throw fail.error;
    },
    async presignGet(input) {
      calls.push({ op: "presign", input: { ...input } });
      if (fail?.op === "presign") throw fail.error;
      return `https://store.example/${input.Key}?sig=1`;
    },
  };
  return { client, calls };
}

const CONFIG = mediaStoreConfigFromEnv(FULL_ENV);

test("without configuration every operation answers not_configured and touches nothing", async () => {
  const { client, calls } = fakeClient();
  const store = createMediaStore(null, client);
  assert.deepEqual(await store.put(PATH, new Uint8Array([1]), { contentType: "image/jpeg" }), {
    ok: false,
    error: "not_configured",
  });
  assert.deepEqual(await store.signedUrl(PATH), { ok: false, error: "not_configured" });
  assert.deepEqual(await store.remove(PATH), { ok: false, error: "not_configured" });
  assert.equal(calls.length, 0);
});

test("put sends the bucket, the path, the bytes and the type (the name goes in the link)", async () => {
  const { client, calls } = fakeClient();
  const store = createMediaStore(CONFIG, client);
  const body = new Uint8Array([1, 2, 3]);
  const result = await store.put(PATH, body, { contentType: "application/pdf" });
  assert.deepEqual(result, { ok: true, value: undefined });
  assert.equal(calls[0].op, "put");
  assert.deepEqual(calls[0].input, {
    Bucket: "whatsapp-media-test",
    Key: PATH,
    Body: body,
    ContentType: "application/pdf",
    ContentLength: 3,
  });
});

test("the signed link lasts 300 seconds", async () => {
  const { client, calls } = fakeClient();
  const store = createMediaStore(CONFIG, client);
  const result = await store.signedUrl(PATH);
  assert.equal(result.ok, true);
  assert.equal(SIGNED_URL_SECONDS, 300);
  assert.deepEqual(calls[0].input, { Bucket: "whatsapp-media-test", Key: PATH, expiresIn: 300 });
});

test("a path that is not <tenant>/<media> is refused before reaching the store", async () => {
  const { client, calls } = fakeClient();
  const store = createMediaStore(CONFIG, client);
  for (const bad of ["../x", `${TENANT}/estudio.pdf`, `${TENANT}/${MEDIA}/x`, "", `${TENANT}`]) {
    assert.deepEqual(await store.signedUrl(bad), { ok: false, error: "invalid_path" }, bad);
    assert.deepEqual(await store.remove(bad), { ok: false, error: "invalid_path" }, bad);
  }
  assert.equal(calls.length, 0);
});

test("a store failure is a short code, never the provider's message", async () => {
  const secretish = new Error("AccessDenied for key AKIA... at https://project.storage.example.co bucket whatsapp-media-test");
  for (const op of ["put", "presign", "remove"]) {
    const { client } = fakeClient({ op, error: secretish });
    const store = createMediaStore(CONFIG, client);
    const result =
      op === "put"
        ? await store.put(PATH, new Uint8Array([1]), { contentType: "image/jpeg" })
        : op === "presign"
          ? await store.signedUrl(PATH)
          : await store.remove(PATH);
    assert.deepEqual(result, { ok: false, error: "store_failed" }, op);
    assert.ok(!JSON.stringify(result).includes("AKIA"));
  }
});

test("removing is the same call for a copy that exists and one that does not", async () => {
  const { client, calls } = fakeClient();
  const store = createMediaStore(CONFIG, client);
  assert.deepEqual(await store.remove(PATH), { ok: true, value: undefined });
  assert.deepEqual(calls[0].input, { Bucket: "whatsapp-media-test", Key: PATH });
});

test("without the five variables no store client is ever built (it would look for other keys on the machine)", async () => {
  let built = 0;
  const factory = () => {
    built += 1;
    return fakeClient().client;
  };
  const store = mediaStoreFromEnv({}, factory);
  assert.deepEqual(await store.signedUrl(PATH), { ok: false, error: "not_configured" });
  assert.equal(built, 0);
  mediaStoreFromEnv({ ...FULL_ENV, WA_MEDIA_STORE_SECRET_ACCESS_KEY: "" }, factory);
  assert.equal(built, 0);
  mediaStoreFromEnv(FULL_ENV, factory);
  assert.equal(built, 1);
});

test("the signed link can carry the download name and the type, set by the server when signing", async () => {
  const { client, calls } = fakeClient();
  const store = createMediaStore(CONFIG, client);
  await store.signedUrl(PATH, { contentDisposition: "attachment; filename=\"a.docx\"", contentType: "application/octet-stream" });
  assert.deepEqual(calls[0].input, {
    Bucket: "whatsapp-media-test",
    Key: PATH,
    expiresIn: 300,
    ResponseContentDisposition: 'attachment; filename="a.docx"',
    ResponseContentType: "application/octet-stream",
  });
});

test("put refuses a body over 16 MB with its own code, even if admission already filtered it", async () => {
  const { client, calls } = fakeClient();
  const store = createMediaStore(CONFIG, client);
  assert.deepEqual(await store.put(PATH, new Uint8Array(MAX_MEDIA_BYTES + 1), { contentType: "video/mp4" }), {
    ok: false,
    error: "too_large",
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(await store.put(PATH, new Uint8Array(MAX_MEDIA_BYTES), { contentType: "video/mp4" }), { ok: true, value: undefined });
});

test("the server's store is built once per process", () => {
  assert.equal(serverMediaStore(), serverMediaStore());
});

test("the fallback download name is chosen by the caller (the business language)", () => {
  assert.equal(
    contentDispositionFor("download", "", "file"),
    `attachment; filename="file"; filename*=UTF-8''file`,
  );
  assert.equal(safeDownloadName("", "file"), "file");
});
