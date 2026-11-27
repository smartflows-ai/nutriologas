// src/lib/wa-media-ingest.ts
// Ticket #182: takes one file row from "received" to stored, or to the reason it is not (plan R1 to R7, section 4).
// 1. RECEIVED: the origin describes the message by its key (the FULL message: size, type, name, caption, view once).
//    The workflow's trimmed shape is never enough to decide. Then the data layer admits it inside one locked
//    transaction (wa-media-data.ts), so two arrivals at once never pass a limit.
// 2. PENDING: the origin downloads the bytes; the real size is checked again; the type is read from the bytes
//    (sniffMime), never taken from the sender; the store keeps it under <tenantId>/<id>.
// Without an origin or a store, or for a business that is off, nothing is attempted and no attempt is used. Every
// failure uses one attempt; the last one closes the row (FAILED, or SIZE_UNKNOWN when the message could never be read).
// The attempt right after sync (plan v9-v11) passes `maxBytes` and one deadline: a heavier file waits for the round, and
// an attempt cut by the deadline uses no attempt either. Everything outside is injected (tests/wa-media-ingest.test.ts).
import {
  MAX_MEDIA_ATTEMPTS,
  MAX_MEDIA_BYTES,
  mediaStoragePath,
  sniffMime,
  type Admission,
  type MediaInfo,
  type MediaKind,
  type MediaStatus,
} from "@/lib/wa-media-rules";
import { storedContentType, type MediaStore } from "@/lib/wa-media-storage";

/** First bytes read to decide the real type. */
const SNIFF_BYTES = 32;

/**
 * Largest declared size fetched at arrival, inside sync. 3 MiB: the 2.1 MB video measured on 2026-11-26 (2,183,734
 * bytes) came in 871 ms, about 2.5 MB/s, so 3 MiB takes about 1.3 s and fits the 6 s deadline. Heavier files wait for
 * the 15-minute round.
 */
export const INLINE_MAX_BYTES = 3 * 1024 * 1024;

/**
 * "no_line": the business has no WhatsApp line connected, so there is nobody to ask. "too_large": the connection's
 * answer declared more than a 16 MB file can weigh, and was refused without reading it.
 */
export type OriginError = "timeout" | "network" | "http" | "no_line" | "too_large";
export type OriginResult<T> = { ok: true; value: T } | { ok: false; error: OriginError };

export interface MediaRef {
  tenantId: string;
  keyId: string;
  remoteJid: string;
  fromMe: boolean;
}

/** Where the file comes from: the WhatsApp connection. `describe` gives null when the message is not found. */
export interface MediaOrigin {
  describe(ref: MediaRef, signal?: AbortSignal): Promise<OriginResult<MediaInfo | null>>;
  download(ref: MediaRef, signal?: AbortSignal): Promise<OriginResult<Uint8Array>>;
}

export interface IngestRow extends MediaRef {
  id: string;
  kind: MediaKind;
  status: MediaStatus;
  attempts: number;
  destroyedAt: Date | null;
  /** Size known for the row (declared, once described); null when not known yet. */
  sizeBytes: number | null;
}

export interface StoredResult {
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number;
}

export interface IngestDeps {
  origin: MediaOrigin | null;
  store: MediaStore;
  storeConfigured: boolean;
  /** The server switch for the row's business: off means nothing is fetched (its rows wait for their day 30). */
  enabledFor(tenantId: string): boolean;
  now(): Date;
  loadRow(mediaId: string): Promise<IngestRow | null>;
  /** Counts and writes the verdict in one locked transaction; returns the verdict. */
  admit(mediaId: string, info: MediaInfo, now: Date): Promise<Admission>;
  markStored(mediaId: string, result: StoredResult): Promise<void>;
  /** Null when the real size is not known (the connection refused an answer too large to read). */
  markTooLarge(mediaId: string, sizeBytes: number | null): Promise<void>;
  /** One attempt used; with a final status the row is closed with it. `reason` is a short code. */
  markAttemptFailed(mediaId: string, reason: string, finalStatus: MediaStatus | null): Promise<void>;
}

/**
 * "deferred": let in but heavier than the attempt at arrival takes (the round fetches it). "cut": the deadline of the
 * attempt at arrival ended it. "disabled": the business is off. None of the three uses an attempt.
 */
export type IngestOutcome =
  | "stored"
  | "retry"
  | "skipped"
  | "no_origin"
  | "no_store"
  | "deferred"
  | "cut"
  | "disabled"
  | Admission
  | "FAILED"
  | "SIZE_UNKNOWN";

export interface IngestOptions {
  /** Fetch only a file whose known size is at most this; otherwise leave it for the round ("deferred"). */
  maxBytes?: number;
  /** One deadline for the whole attempt (describe, download, store). When it fires, the attempt is "cut". */
  signal?: AbortSignal;
}

const WORK_STATUSES: readonly MediaStatus[] = ["RECEIVED", "PENDING"];
const NOT_FOUND = "message_not_found";

/**
 * The status that closes a row on its last attempt. A pending row (already let in) failed to arrive. A received row
 * whose message the connection no longer has (a line reconnected, for example) failed too: SIZE_UNKNOWN would say "the
 * message did not tell its size", which is false and blurs that count. A received row that could never be read at all
 * (timeouts, errors) stays SIZE_UNKNOWN.
 */
function closingStatus(row: IngestRow, reason: string): MediaStatus {
  return row.status === "RECEIVED" && reason !== NOT_FOUND ? "SIZE_UNKNOWN" : "FAILED";
}

async function failAttempt(deps: IngestDeps, row: IngestRow, reason: string, signal: AbortSignal | undefined): Promise<IngestOutcome> {
  // The deadline of the attempt at arrival is not a failure of the file: the round tries it again, at no cost.
  if (signal?.aborted) return "cut";
  const isLast = row.attempts + 1 >= MAX_MEDIA_ATTEMPTS;
  const finalStatus: MediaStatus | null = isLast ? closingStatus(row, reason) : null;
  await deps.markAttemptFailed(row.id, reason, finalStatus);
  return finalStatus === "SIZE_UNKNOWN" ? "SIZE_UNKNOWN" : finalStatus === "FAILED" ? "FAILED" : "retry";
}

function isTooHeavyForNow(sizeBytes: number | null, options: IngestOptions): boolean {
  return options.maxBytes !== undefined && (sizeBytes === null || sizeBytes > options.maxBytes);
}

/** Describes and admits a received row. Returns the outcome when it ends here, or the row let in (PENDING). */
async function describeAndAdmit(deps: IngestDeps, origin: MediaOrigin, row: IngestRow, options: IngestOptions): Promise<IngestOutcome | IngestRow> {
  const described = await origin.describe(row, options.signal);
  if (!described.ok) return failAttempt(deps, row, `describe_${described.error}`, options.signal);
  if (!described.value) return failAttempt(deps, row, NOT_FOUND, options.signal);
  const verdict = await deps.admit(row.id, described.value, deps.now());
  return verdict === "PENDING" ? { ...row, status: "PENDING", sizeBytes: described.value.declaredBytes } : verdict;
}

async function downloadAndStore(deps: IngestDeps, origin: MediaOrigin, row: IngestRow, signal: AbortSignal | undefined): Promise<IngestOutcome> {
  const downloaded = await origin.download(row, signal);
  if (!downloaded.ok && downloaded.error === "too_large") {
    // The same end as the check after the download: the declared size lied, and the file is never stored.
    await deps.markTooLarge(row.id, null);
    return "TOO_LARGE";
  }
  if (!downloaded.ok) return failAttempt(deps, row, `download_${downloaded.error}`, signal);
  const bytes = downloaded.value;
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    await deps.markTooLarge(row.id, bytes.byteLength);
    return "TOO_LARGE";
  }
  const mimeType = sniffMime(bytes.subarray(0, SNIFF_BYTES));
  const storagePath = mediaStoragePath(row.tenantId, row.id);
  // The same path on every try: a copy left by an attempt that was cut is overwritten, never duplicated.
  const put = await deps.store.put(storagePath, bytes, { contentType: storedContentType(mimeType), signal });
  if (!put.ok) return failAttempt(deps, row, put.error, signal);
  await deps.markStored(row.id, { storagePath, mimeType, sizeBytes: bytes.byteLength });
  return "stored";
}

export async function ingestMedia(deps: IngestDeps, mediaId: string, options: IngestOptions = {}): Promise<IngestOutcome> {
  const row = await deps.loadRow(mediaId);
  if (!row || row.destroyedAt || !WORK_STATUSES.includes(row.status) || row.attempts >= MAX_MEDIA_ATTEMPTS) return "skipped";
  if (!deps.enabledFor(row.tenantId)) return "disabled";
  if (!deps.origin) return "no_origin";
  if (!deps.storeConfigured) return "no_store";
  const admitted = row.status === "RECEIVED" ? await describeAndAdmit(deps, deps.origin, row, options) : row;
  if (typeof admitted === "string") return admitted;
  if (isTooHeavyForNow(admitted.sizeBytes, options)) return "deferred";
  return downloadAndStore(deps, deps.origin, admitted, options.signal);
}
