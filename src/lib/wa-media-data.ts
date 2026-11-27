// src/lib/wa-media-data.ts
// Ticket #182: every database read and write of WhatsApp file rows. Every query carries the business id; the routes
// pass the one from the session, the internal jobs the one stored on the row. Sizes are BIGINT in the database and
// leave this module as numbers. Admission counts and writes in ONE transaction behind a platform-wide advisory lock,
// so two arrivals at the same time never pass the contact, business or platform limit.
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  CONTACT_COUNTED_STATUSES,
  MAX_MEDIA_ATTEMPTS,
  TENANT_BYTE_STATUSES,
  admitMedia,
  contactDayWindow,
  destroyAfterOf,
  destroyedPatch,
  destructionRequestPatch,
  hidePatch,
  isMediaEnabledFor,
  mediaEnabledTenantIds,
  mediaOf,
  platformMaxBytesOf,
  restorePatch,
  type Admission,
  type MediaInfo,
  type MediaKind,
  type MediaStatus,
} from "@/lib/wa-media-rules";
import {
  INLINE_MAX_BYTES,
  ingestMedia,
  type IngestDeps,
  type IngestOutcome,
  type IngestRow,
  type MediaOrigin,
  type StoredResult,
} from "@/lib/wa-media-ingest";
import { STORE_TIMEOUT_MS, retryCutoff, type PurgeDeps } from "@/lib/wa-media-purge";
import { serverMediaOrigin } from "@/lib/wa-media-origin";
import { summaryOf, type MediaSummary } from "@/lib/wa-media-summary";
import { mediaStoreConfigFromEnv, serverMediaStore, type MediaStore } from "@/lib/wa-media-storage";

/** Key of the advisory lock that serializes admissions (any fixed number; only this module takes it). */
const ADMISSION_LOCK_KEY = 182_0001;

const toNumber = (value: bigint | null | undefined): number | null => (value === null || value === undefined ? null : Number(value));

/** The server switch, read where the decision is made. */
export function mediaEnabledFor(tenantId: string): boolean {
  return isMediaEnabledFor(tenantId, process.env.WA_MEDIA_ENABLED_TENANTS);
}

/** The businesses that are on, for the round's retries. */
function enabledTenantIds(): string[] {
  return mediaEnabledTenantIds(process.env.WA_MEDIA_ENABLED_TENANTS);
}

/**
 * The whole attempt right after sync must end within this time: the workflow waits 10 s for sync (read in the live
 * workflow on 2026-11-27) and those calls take 118 to 321 ms today, so 6 s leaves room for the rest of sync.
 */
export const INLINE_DEADLINE_MS = 6_000;

// ── whatsapp/sync: note the file a message carries ──────────────────────────

export interface SyncMediaInput {
  tenantId: string;
  chatId: string;
  messageId: string;
  keyId: string;
  fromMe: boolean;
  message: unknown;
  receivedAt: Date;
}

/**
 * One row per business and message id (a retry of sync adds nothing). View once is decided here, from the shape
 * alone, and never downloaded; everything else waits as RECEIVED for the full message. Returns the row id, or
 * null when the message carries no file.
 */
export async function noteMediaFromSync(input: SyncMediaInput): Promise<string | null> {
  const media = mediaOf(input.message);
  if (!media) return null;
  const row = await prisma.whatsAppMedia.upsert({
    where: { tenantId_keyId: { tenantId: input.tenantId, keyId: input.keyId } },
    update: {},
    create: {
      tenantId: input.tenantId,
      chatId: input.chatId,
      messageId: input.messageId,
      keyId: input.keyId,
      fromMe: input.fromMe,
      kind: media.kind,
      status: media.viewOnce ? "VIEW_ONCE" : "RECEIVED",
      fileName: media.fileName,
      caption: media.caption,
      sizeBytes: media.declaredBytes === null ? null : BigInt(media.declaredBytes),
      receivedAt: input.receivedAt,
      destroyAfter: destroyAfterOf(input.receivedAt),
    },
    select: { id: true },
  });
  return row.id;
}

// ── Admission and ingest ────────────────────────────────────────────────────

async function bytesInUse(tx: Prisma.TransactionClient, tenantId?: string): Promise<number> {
  const sum = await tx.whatsAppMedia.aggregate({
    where: { ...(tenantId ? { tenantId } : {}), status: { in: [...TENANT_BYTE_STATUSES] }, destroyedAt: null },
    _sum: { sizeBytes: true },
  });
  return toNumber(sum._sum.sizeBytes) ?? 0;
}

/** Counts and writes the verdict in one transaction, behind the platform lock. Only a RECEIVED row is admitted. */
export async function admitMediaRow(mediaId: string, info: MediaInfo): Promise<Admission> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(${ADMISSION_LOCK_KEY})) AS locked`;
    const row = await tx.whatsAppMedia.findUnique({
      where: { id: mediaId },
      select: { tenantId: true, chatId: true, fromMe: true, status: true, receivedAt: true, tenant: { select: { timeZone: true } } },
    });
    if (!row || row.status !== "RECEIVED") return (row?.status ?? "SIZE_UNKNOWN") as Admission;
    const { start, end } = contactDayWindow(row.receivedAt, row.tenant.timeZone);
    const contactCountToday =
      row.fromMe || !row.chatId
        ? 0
        : await tx.whatsAppMedia.count({
            where: {
              tenantId: row.tenantId,
              chatId: row.chatId,
              fromMe: false,
              status: { in: [...CONTACT_COUNTED_STATUSES] },
              receivedAt: { gte: start, lt: end },
            },
          });
    const verdict = admitMedia({
      viewOnce: info.viewOnce,
      declaredBytes: info.declaredBytes,
      fromMe: row.fromMe,
      contactCountToday,
      tenantBytesInUse: await bytesInUse(tx, row.tenantId),
      platformBytesInUse: await bytesInUse(tx),
      platformMaxBytes: platformMaxBytesOf(process.env.WA_MEDIA_PLATFORM_MAX_BYTES),
    });
    await tx.whatsAppMedia.update({
      where: { id: mediaId },
      data: {
        status: verdict,
        kind: info.kind,
        sizeBytes: info.declaredBytes === null ? null : BigInt(info.declaredBytes),
        fileName: info.viewOnce ? null : info.fileName,
        caption: info.viewOnce ? null : info.caption,
      },
    });
    return verdict;
  });
}

async function loadIngestRow(mediaId: string): Promise<IngestRow | null> {
  const row = await prisma.whatsAppMedia.findUnique({
    where: { id: mediaId },
    select: {
      id: true, tenantId: true, keyId: true, fromMe: true, kind: true, status: true, attempts: true, destroyedAt: true,
      sizeBytes: true, chat: { select: { remoteJid: true } },
    },
  });
  if (!row || !row.chat) return null;
  return {
    id: row.id, tenantId: row.tenantId, keyId: row.keyId, remoteJid: row.chat.remoteJid, fromMe: row.fromMe,
    kind: row.kind as MediaKind, status: row.status as MediaStatus, attempts: row.attempts, destroyedAt: row.destroyedAt,
    sizeBytes: toNumber(row.sizeBytes),
  };
}

/** The store's own timeout, plus the caller's deadline when there is one. */
function storeSignal(timeoutMs: number, callerSignal: AbortSignal | undefined): AbortSignal {
  const own = AbortSignal.timeout(timeoutMs);
  return callerSignal ? AbortSignal.any([own, callerSignal]) : own;
}

/**
 * Every upload and every removal ends by its own timeout, so one slow store never holds a run past the workflow's
 * limit. A timed-out upload uses one attempt; a timed-out removal leaves the row as it is, for the next run.
 */
function withStoreTimeouts(store: MediaStore, timeoutMs: number): MediaStore {
  return {
    ...store,
    put: (path, body, options) => store.put(path, body, { ...options, signal: storeSignal(timeoutMs, options.signal) }),
    remove: (path, signal) => store.remove(path, storeSignal(timeoutMs, signal)),
  };
}

/** The real dependencies of ingestMedia. Without an origin (no connection configured) nothing is fetched. */
export function ingestDeps(origin: MediaOrigin | null, store: MediaStore, storeConfigured: boolean): IngestDeps {
  return {
    origin,
    store: withStoreTimeouts(store, STORE_TIMEOUT_MS),
    storeConfigured,
    enabledFor: mediaEnabledFor,
    now: () => new Date(),
    loadRow: loadIngestRow,
    admit: (mediaId, info) => admitMediaRow(mediaId, info),
    async markStored(mediaId: string, result: StoredResult) {
      await prisma.whatsAppMedia.update({
        where: { id: mediaId },
        data: { status: "STORED", storagePath: result.storagePath, mimeType: result.mimeType, sizeBytes: BigInt(result.sizeBytes), failureReason: null },
      });
    },
    async markTooLarge(mediaId: string, sizeBytes: number | null) {
      // Null: the connection refused the answer before reading it, so the size the row has is kept.
      await prisma.whatsAppMedia.update({
        where: { id: mediaId },
        data: { status: "TOO_LARGE", ...(sizeBytes === null ? {} : { sizeBytes: BigInt(sizeBytes) }) },
      });
    },
    async markAttemptFailed(mediaId: string, reason: string, finalStatus: MediaStatus | null) {
      await prisma.whatsAppMedia.update({
        where: { id: mediaId },
        data: { attempts: { increment: 1 }, failureReason: reason, ...(finalStatus ? { status: finalStatus } : {}) },
      });
    },
  };
}

// ── Purge job ───────────────────────────────────────────────────────────────

export interface PurgeRow {
  id: string;
  tenantId: string;
  status: MediaStatus;
  storagePath: string | null;
}

/** Rows due today: their date came, their chat was deleted (mark), or the chat is gone (null). Oldest first. */
export async function listDueForDestruction(now: Date, limit: number): Promise<PurgeRow[]> {
  const rows = await prisma.whatsAppMedia.findMany({
    where: { destroyedAt: null, OR: [{ destroyAfter: { lte: now } }, { destroyRequestedAt: { not: null } }, { chatId: null }] },
    orderBy: { destroyAfter: "asc" },
    take: limit,
    select: { id: true, tenantId: true, status: true, storagePath: true },
  });
  return rows.map((row) => ({ ...row, status: row.status as MediaStatus }));
}

export async function markDestroyed(mediaId: string, status: MediaStatus, at: Date): Promise<void> {
  await prisma.whatsAppMedia.update({ where: { id: mediaId }, data: destroyedPatch(status, at) });
}

/** Rows still to fetch of the businesses that are on, untouched for at least `idleMs`, with attempts left. */
export async function listRetryable(now: Date, idleMs: number, limit: number, tenantIds: readonly string[]): Promise<string[]> {
  if (tenantIds.length === 0) return [];
  const rows = await prisma.whatsAppMedia.findMany({
    where: {
      tenantId: { in: [...tenantIds] },
      destroyedAt: null,
      status: { in: ["RECEIVED", "PENDING"] },
      attempts: { lt: MAX_MEDIA_ATTEMPTS },
      updatedAt: { lte: retryCutoff(now, idleMs) },
      chatId: { not: null },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * The real dependencies of the purge at the end of the 15-minute job. Without an origin (no WhatsApp connection on
 * this server) nothing is fetched or retried, only destroyed when due.
 */
export function mediaPurgeDeps(origin: MediaOrigin | null): PurgeDeps {
  const store = withStoreTimeouts(serverMediaStore(), STORE_TIMEOUT_MS);
  const storeConfigured = mediaStoreConfigFromEnv() !== null;
  const deps = ingestDeps(origin, serverMediaStore(), storeConfigured);
  return {
    store,
    storeConfigured,
    listDue: listDueForDestruction,
    markDestroyed,
    enabledTenantIds: enabledTenantIds(),
    listRetryable,
    ingest: origin ? (mediaId) => ingestMedia(deps, mediaId) : null,
  };
}

// ── whatsapp/sync: the attempt right after the row is noted ─────────────────

/**
 * Fetches a light file (at most INLINE_MAX_BYTES) right away, inside ONE deadline for the whole attempt. sync answers
 * by the deadline even if a database write ignores the signal (the race); whatever did not end is left as it is, and
 * the 15-minute round takes it after RETRY_IDLE_MS. A cut and a heavier file use no attempt.
 */
export async function fetchMediaAtArrival(mediaId: string): Promise<IngestOutcome> {
  const deps = ingestDeps(serverMediaOrigin(), serverMediaStore(), mediaStoreConfigFromEnv() !== null);
  const signal = AbortSignal.timeout(INLINE_DEADLINE_MS);
  const deadline = new Promise<IngestOutcome>((resolve) => {
    signal.addEventListener("abort", () => resolve("cut"), { once: true });
  });
  const attempt = ingestMedia(deps, mediaId, { maxBytes: INLINE_MAX_BYTES, signal });
  // A failure that comes after the deadline already answered is not left unhandled.
  attempt.catch(() => undefined);
  return Promise.race([attempt, deadline]);
}

// ── Panel: summaries, one file, hide and restore ────────────────────────────

export type { MediaSummary } from "@/lib/wa-media-summary";

const SUMMARY_SELECT = {
  id: true, messageId: true, kind: true, status: true, fileName: true, caption: true, sizeBytes: true, mimeType: true,
  destroyAfter: true, destroyedAt: true, hiddenAt: true, hiddenBy: { select: { name: true } },
} as const;

/** The file of each message of a chat page, by message id. Scoped to the session's business. */
export async function mediaSummariesFor(tenantId: string, messageIds: string[], now = new Date()): Promise<Map<string, MediaSummary>> {
  if (messageIds.length === 0) return new Map();
  const rows = await prisma.whatsAppMedia.findMany({ where: { tenantId, messageId: { in: messageIds } }, select: SUMMARY_SELECT });
  return new Map(rows.map((row) => [row.messageId as string, summaryOf(row, now)]));
}

export interface MediaForLink {
  id: string;
  kind: MediaKind;
  status: MediaStatus;
  fileName: string | null;
  mimeType: string | null;
  storagePath: string | null;
  destroyAfter: Date;
  destroyedAt: Date | null;
  hiddenAt: Date | null;
}

/** One file of the session's business, or null (another business's id and an invented one look the same). */
export async function findMediaForTenant(tenantId: string, mediaId: string): Promise<MediaForLink | null> {
  const row = await prisma.whatsAppMedia.findFirst({
    where: { id: mediaId, tenantId },
    select: { id: true, kind: true, status: true, fileName: true, mimeType: true, storagePath: true, destroyAfter: true, destroyedAt: true, hiddenAt: true },
  });
  return row ? { ...row, kind: row.kind as MediaKind, status: row.status as MediaStatus } : null;
}

export type HideResult = "done" | "not_found" | "not_available";

/** R6: hide or restore a stored copy, writing who, with which role and when. Never moves the destruction date. */
export async function setMediaHidden(
  tenantId: string,
  mediaId: string,
  actor: { userId: string; role: UserRole },
  hide: boolean,
  now = new Date(),
): Promise<HideResult> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.whatsAppMedia.findFirst({
      where: { id: mediaId, tenantId },
      select: { id: true, status: true, destroyedAt: true, destroyAfter: true, hiddenAt: true },
    });
    if (!row) return "not_found";
    const copyLives = row.status === "STORED" && !row.destroyedAt && row.destroyAfter.getTime() > now.getTime();
    if (!copyLives || (hide ? row.hiddenAt !== null : row.hiddenAt === null)) return "not_available";
    await tx.whatsAppMedia.update({ where: { id: row.id }, data: hide ? hidePatch(actor.userId, now) : restorePatch() });
    await tx.whatsAppMediaTrail.create({
      data: { tenantId, mediaId: row.id, action: hide ? "HIDDEN" : "RESTORED", userId: actor.userId, role: actor.role, at: now },
    });
    return "done";
  });
}

/** Deleting a chat: its files are marked for destruction and lose the person's data in the same operation. */
export function destructionRequestForChat(tenantId: string, chatId: string, now = new Date()) {
  return prisma.whatsAppMedia.updateMany({ where: { tenantId, chatId, destroyedAt: null }, data: destructionRequestPatch(now) });
}
