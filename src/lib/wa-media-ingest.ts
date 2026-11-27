// src/lib/wa-media-ingest.ts
// Ticket #182: takes one file row from "received" to stored, or to the reason it is not (plan R1 to R7, section 4).
// 1. RECEIVED: the origin describes the message by its key (the FULL message: size, type, name, caption, view once).
//    The workflow's trimmed shape is never enough to decide. Then the data layer admits it inside one locked
//    transaction (wa-media-data.ts), so two arrivals at once never pass a limit.
// 2. PENDING: the origin downloads the bytes; the real size is checked again; the type is read from the bytes
//    (sniffMime), never taken from the sender; the store keeps it under <tenantId>/<id>.
// Without an origin or a store nothing is attempted and no attempt is used. Every failure uses one attempt; the last
// one closes the row. Everything outside is injected (tests/wa-media-ingest.test.ts): no network, no database here.
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

export type OriginError = "timeout" | "network" | "http";
export type OriginResult<T> = { ok: true; value: T } | { ok: false; error: OriginError };

export interface MediaRef {
  tenantId: string;
  keyId: string;
  remoteJid: string;
  fromMe: boolean;
}

/** Where the file comes from: the WhatsApp connection. `describe` gives null when the message is not found. */
export interface MediaOrigin {
  describe(ref: MediaRef): Promise<OriginResult<MediaInfo | null>>;
  download(ref: MediaRef): Promise<OriginResult<Uint8Array>>;
}

export interface IngestRow extends MediaRef {
  id: string;
  kind: MediaKind;
  status: MediaStatus;
  attempts: number;
  destroyedAt: Date | null;
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
  now(): Date;
  loadRow(mediaId: string): Promise<IngestRow | null>;
  /** Counts and writes the verdict in one locked transaction; returns the verdict. */
  admit(mediaId: string, info: MediaInfo, now: Date): Promise<Admission>;
  markStored(mediaId: string, result: StoredResult): Promise<void>;
  markTooLarge(mediaId: string, sizeBytes: number): Promise<void>;
  /** One attempt used; with a final status the row is closed with it. `reason` is a short code. */
  markAttemptFailed(mediaId: string, reason: string, finalStatus: MediaStatus | null): Promise<void>;
}

export type IngestOutcome = "stored" | "retry" | "skipped" | "no_origin" | "no_store" | Admission | "FAILED" | "SIZE_UNKNOWN";

const WORK_STATUSES: readonly MediaStatus[] = ["RECEIVED", "PENDING"];

async function failAttempt(deps: IngestDeps, row: IngestRow, reason: string): Promise<IngestOutcome> {
  const isLast = row.attempts + 1 >= MAX_MEDIA_ATTEMPTS;
  // A row never described could not even be sized; a row already let in failed to arrive.
  const finalStatus: MediaStatus | null = isLast ? (row.status === "RECEIVED" ? "SIZE_UNKNOWN" : "FAILED") : null;
  await deps.markAttemptFailed(row.id, reason, finalStatus);
  return finalStatus === "SIZE_UNKNOWN" ? "SIZE_UNKNOWN" : finalStatus === "FAILED" ? "FAILED" : "retry";
}

async function describeAndAdmit(deps: IngestDeps, origin: MediaOrigin, row: IngestRow): Promise<IngestOutcome | null> {
  const described = await origin.describe(row);
  if (!described.ok) return failAttempt(deps, row, `describe_${described.error}`);
  if (!described.value) return failAttempt(deps, row, "message_not_found");
  const verdict = await deps.admit(row.id, described.value, deps.now());
  return verdict === "PENDING" ? null : verdict;
}

async function downloadAndStore(deps: IngestDeps, origin: MediaOrigin, row: IngestRow): Promise<IngestOutcome> {
  const downloaded = await origin.download(row);
  if (!downloaded.ok) return failAttempt(deps, row, `download_${downloaded.error}`);
  const bytes = downloaded.value;
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    await deps.markTooLarge(row.id, bytes.byteLength);
    return "TOO_LARGE";
  }
  const mimeType = sniffMime(bytes.subarray(0, SNIFF_BYTES));
  const storagePath = mediaStoragePath(row.tenantId, row.id);
  const put = await deps.store.put(storagePath, bytes, { contentType: storedContentType(mimeType) });
  if (!put.ok) return failAttempt(deps, row, put.error);
  await deps.markStored(row.id, { storagePath, mimeType, sizeBytes: bytes.byteLength });
  return "stored";
}

export async function ingestMedia(deps: IngestDeps, mediaId: string): Promise<IngestOutcome> {
  const row = await deps.loadRow(mediaId);
  if (!row || row.destroyedAt || !WORK_STATUSES.includes(row.status) || row.attempts >= MAX_MEDIA_ATTEMPTS) return "skipped";
  if (!deps.origin) return "no_origin";
  if (!deps.storeConfigured) return "no_store";
  if (row.status === "RECEIVED") {
    const rejected = await describeAndAdmit(deps, deps.origin, row);
    if (rejected) return rejected;
  }
  return downloadAndStore(deps, deps.origin, { ...row, status: "PENDING" });
}
