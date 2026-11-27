// src/lib/wa-media-storage.ts
// Ticket #182: the only door to the private store of WhatsApp files (S3 protocol, with a key limited to the store).
// Three operations: put a file, give a signed read link that expires in 5 minutes, remove a file.
// - Config comes only from the server variables WA_MEDIA_STORE_*; without all five the store is "not configured"
//   and nothing is attempted. Credentials are always passed explicitly, so the client never looks for other keys
//   on the machine (profiles, environment of another tool).
// - The type is fixed at upload (Content-Type). The download name and, when needed, the type the browser sees go in
//   the signed link (response overrides), set by the server when it signs: the provider stores a Content-Disposition
//   given at upload but does not serve it back (store check of 2026-11-25), while the link overrides work (2026-11-26).
// - Errors are a short code. The provider's message, the endpoint, the bucket and the keys never leave this module.
// The client is injected in tests (tests/wa-media-storage.test.ts), so they never reach the network.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_MEDIA_BYTES, isPathOfTenant, type DisplayMode } from "@/lib/wa-media-rules";

/** R8: a signed link opens for 5 minutes. */
export const SIGNED_URL_SECONDS = 300;
export const MAX_DOWNLOAD_NAME_LENGTH = 120;
const MAX_EXTENSION_LENGTH = 10;
const GENERIC_BINARY = "application/octet-stream";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export interface MediaStoreConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type StoreError = "not_configured" | "invalid_path" | "too_large" | "store_failed";
export type StoreResult<T> = { ok: true; value: T } | { ok: false; error: StoreError };

export interface PutOptions {
  contentType: string;
  /** The caller's deadline (the attempt at arrival): when it fires, the upload is aborted. */
  signal?: AbortSignal;
}

/** What the store needs from an S3 client. The real one wraps the official SDK; tests pass a fake. */
export interface MediaStoreClient {
  put(input: {
    Bucket: string;
    Key: string;
    Body: Uint8Array;
    ContentType: string;
    ContentLength: number;
  }, signal?: AbortSignal): Promise<void>;
  remove(input: { Bucket: string; Key: string }, signal?: AbortSignal): Promise<void>;
  presignGet(input: {
    Bucket: string;
    Key: string;
    expiresIn: number;
    ResponseContentDisposition?: string;
    ResponseContentType?: string;
  }): Promise<string>;
}

/** What the response of a signed link says about the file, set by the server when it signs (never by the browser). */
export interface SignedUrlOptions {
  contentDisposition?: string;
  contentType?: string;
}

export interface MediaStore {
  put(path: string, body: Uint8Array, options: PutOptions): Promise<StoreResult<void>>;
  signedUrl(path: string, options?: SignedUrlOptions): Promise<StoreResult<string>>;
  /** `signal`: the caller's timeout; when it fires, the removal is aborted (and reported as failed, to retry). */
  remove(path: string, signal?: AbortSignal): Promise<StoreResult<void>>;
}

// ── Config ──────────────────────────────────────────────────────────────────

function parsedUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isAllowedEndpoint(url: URL): boolean {
  return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}

type EnvLike = Record<string, string | undefined>;

export function mediaStoreConfigFromEnv(env: EnvLike = process.env): MediaStoreConfig | null {
  const value = (name: string) => env[name]?.trim() ?? "";
  const config = {
    endpoint: value("WA_MEDIA_STORE_ENDPOINT"),
    region: value("WA_MEDIA_STORE_REGION"),
    bucket: value("WA_MEDIA_STORE_BUCKET"),
    accessKeyId: value("WA_MEDIA_STORE_ACCESS_KEY_ID"),
    secretAccessKey: value("WA_MEDIA_STORE_SECRET_ACCESS_KEY"),
  };
  if (Object.values(config).some((v) => !v)) return null;
  const url = parsedUrl(config.endpoint);
  return url && isAllowedEndpoint(url) ? config : null;
}

/** Scheme, host and port of the store endpoint, for the page policy (img-src, media-src). Null when invalid. */
export function storeOrigin(endpoint: string | undefined): string | null {
  const url = parsedUrl(endpoint?.trim());
  return url && isAllowedEndpoint(url) ? url.origin : null;
}

// ── Download name and type ──────────────────────────────────────────────────

// Control characters, quotes, separators and signs a header or a file system reads as structure.
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f"';:\\/<>|?*]+/g;

function cutKeepingExtension(name: string): string {
  if (name.length <= MAX_DOWNLOAD_NAME_LENGTH) return name;
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 && name.length - dot <= MAX_EXTENSION_LENGTH + 1 ? name.slice(dot) : "";
  return name.slice(0, MAX_DOWNLOAD_NAME_LENGTH - extension.length).trimEnd() + extension;
}

/** The sender's file name made safe to put in a header and to save: one line, no quotes, no path, bounded. */
export function safeDownloadName(raw: string | null | undefined, fallback = "archivo"): string {
  const cleaned = (raw ?? "")
    .replace(UNSAFE_NAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .trim();
  return cleaned ? cutKeepingExtension(cleaned) : fallback;
}

/** RFC 5987 encoding for filename*: encodeURIComponent plus the signs it leaves alone. */
function encodeFilename(name: string): string {
  return encodeURIComponent(name).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function asciiFallback(name: string): string {
  return name.replace(/[^ -~]/g, "_");
}

/** R9, for the signed link: media plays inline; a PDF opens in a tab with its name; any other document downloads. */
export function contentDispositionFor(mode: DisplayMode, rawName: string | null | undefined, fallback?: string): string {
  if (mode === "image" || mode === "audio" || mode === "video") return "inline";
  const name = safeDownloadName(rawName, fallback);
  const kind = mode === "pdf-tab" ? "inline" : "attachment";
  return `${kind}; filename="${asciiFallback(name)}"; filename*=UTF-8''${encodeFilename(name)}`;
}

/** The type the app read from the bytes (sniffMime), never the one the sender declared. */
export function storedContentType(sniffedMime: string | null): string {
  return sniffedMime ?? GENERIC_BINARY;
}

// ── Operations ──────────────────────────────────────────────────────────────

function s3ClientOf(config: MediaStoreConfig): MediaStoreClient {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Checksums only when the operation requires them: S3-compatible stores do not all accept the newer defaults.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return {
    async put(input, signal) {
      await client.send(new PutObjectCommand(input), signal ? { abortSignal: signal } : {});
    },
    async remove(input, signal) {
      await client.send(new DeleteObjectCommand(input), signal ? { abortSignal: signal } : {});
    },
    async presignGet({ expiresIn, ...input }) {
      return getSignedUrl(client, new GetObjectCommand(input), { expiresIn });
    },
  };
}

function failureName(error: unknown): string {
  return error instanceof Error ? error.name : "error";
}

async function attempt<T>(operation: string, run: () => Promise<T>): Promise<StoreResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error: unknown) {
    // Only the error class: the provider's message can carry the endpoint, the bucket or part of a key.
    console.error(`[wa-media-storage] ${operation} failed`, failureName(error));
    return { ok: false, error: "store_failed" };
  }
}

/**
 * The store, or one that answers not_configured to everything when the config is missing. Without config no client
 * is built at all: the SDK would otherwise look for keys elsewhere on the machine.
 */
export function createMediaStore(config: MediaStoreConfig | null, injected?: MediaStoreClient | ClientFactory): MediaStore {
  if (!config) {
    const notConfigured = async () => ({ ok: false, error: "not_configured" }) as const;
    return { put: notConfigured, signedUrl: notConfigured, remove: notConfigured };
  }
  const client = typeof injected === "function" ? injected(config) : injected ?? s3ClientOf(config);
  const validPath = (path: string) => {
    const tenantId = path.split("/")[0] ?? "";
    return isPathOfTenant(path, tenantId);
  };
  const invalid = { ok: false, error: "invalid_path" } as const;
  return {
    async put(path, body, options) {
      if (!validPath(path)) return invalid;
      // Defense in depth: admission already refuses larger files, the store never takes one either.
      if (body.byteLength > MAX_MEDIA_BYTES) return { ok: false, error: "too_large" };
      return attempt("put", () =>
        client.put(
          {
            Bucket: config.bucket,
            Key: path,
            Body: body,
            ContentType: options.contentType,
            ContentLength: body.byteLength,
          },
          options.signal,
        ),
      );
    },
    async signedUrl(path, options = {}) {
      if (!validPath(path)) return invalid;
      return attempt("sign", () =>
        client.presignGet({
          Bucket: config.bucket,
          Key: path,
          expiresIn: SIGNED_URL_SECONDS,
          ...(options.contentDisposition ? { ResponseContentDisposition: options.contentDisposition } : {}),
          ...(options.contentType ? { ResponseContentType: options.contentType } : {}),
        }),
      );
    },
    async remove(path, signal) {
      if (!validPath(path)) return invalid;
      return attempt("remove", () => client.remove({ Bucket: config.bucket, Key: path }, signal));
    },
  };
}

export type ClientFactory = (config: MediaStoreConfig) => MediaStoreClient;

/** A store from the given variables. The factory is injected only by tests. */
export function mediaStoreFromEnv(env: EnvLike = process.env, factory: ClientFactory = s3ClientOf): MediaStore {
  return createMediaStore(mediaStoreConfigFromEnv(env), factory);
}

let processStore: MediaStore | null = null;

/** The store of this server process, built once from its variables and reused by every request. */
export function serverMediaStore(): MediaStore {
  processStore ??= mediaStoreFromEnv();
  return processStore;
}
