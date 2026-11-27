// src/lib/wa-media-purge.ts
// Ticket #182, plan R5 and section 4 step 7: run at the end of the 15-minute job (reminders/run), in its own error
// block. Destroys the copies that are due (their 30th day, hidden or not; a deleted chat), for every business, and
// retries the files still to fetch, only for businesses that are on. A copy is marked destroyed only after the store
// removed it: if removing fails, the row stays as it is and the next run tries again.
// Destruction and retries are tied to the run's clock (plan v11): the workflow node that calls the job gives up after
// 60 s, so a row or a file starts only when its whole slot fits before RUN_DEADLINE_MS. What is not started is not
// touched (no attempt used); it waits for the next run. Everything outside is injected (tests/wa-media-purge.test.ts).
import { isPathOfTenant, mediaStoragePath, needsStoreRemoval, type MediaStatus } from "@/lib/wa-media-rules";
import type { IngestOutcome } from "@/lib/wa-media-ingest";
import type { PurgeRow } from "@/lib/wa-media-data";
import type { MediaStore } from "@/lib/wa-media-storage";

/** Rows destroyed per run; the rest wait for the next one, 15 minutes later. */
export const PURGE_BATCH = 50;
/** Files retried per run. */
export const RETRY_BATCH = 20;
/**
 * A file is retried only after this long without changes, so an attempt still running is not repeated. 60 s: the
 * attempt at arrival ends within 6 s and the rounds never overlap (one every 15 minutes, each under 60 s), so the
 * spacing between attempts comes from the round itself. A file deferred at arrival enters the next round.
 */
export const RETRY_IDLE_MS = 60 * 1000;
/**
 * Time from the start of the job's request after which no new file starts. The workflow node waits 60 s (read in the
 * live workflow on 2026-11-27); runs with sends took 0.8 to 9.7 s, so 45 s leaves room for both.
 */
export const RUN_DEADLINE_MS = 45_000;
/** Longest one retried file can take: describe (3 s) + download (12 s) + store (5 s), each with its own timeout. */
export const DESCRIBE_TIMEOUT_MS = 3_000;
export const DOWNLOAD_TIMEOUT_MS = 12_000;
export const STORE_TIMEOUT_MS = 5_000;
export const FILE_SLOT_MS = DESCRIBE_TIMEOUT_MS + DOWNLOAD_TIMEOUT_MS + STORE_TIMEOUT_MS;
/** Longest one destruction can take: the store's removal, with its own timeout. */
export const DESTROY_SLOT_MS = STORE_TIMEOUT_MS;

/** Rows untouched since this moment can be retried. */
export function retryCutoff(now: Date, idleMs: number): Date {
  return new Date(now.getTime() - idleMs);
}

/** How long the job has been running, from the moment its request came in. */
export interface RunClock {
  elapsedMs(): number;
}

export function runClockFrom(startedAt: number, now: () => number = Date.now): RunClock {
  return { elapsedMs: () => now() - startedAt };
}

/** True when a piece of work of `slotMs` still ends before the deadline. */
export function fitsInRun(clock: RunClock, slotMs: number, deadlineMs = RUN_DEADLINE_MS): boolean {
  return clock.elapsedMs() + slotMs <= deadlineMs;
}

export interface PurgeDeps {
  store: MediaStore;
  storeConfigured: boolean;
  listDue(now: Date, limit: number): Promise<PurgeRow[]>;
  markDestroyed(mediaId: string, status: MediaStatus, at: Date): Promise<void>;
  /** Businesses that are on: only their files are retried. Destruction does not look at it. */
  enabledTenantIds: readonly string[];
  listRetryable(now: Date, idleMs: number, limit: number, tenantIds: readonly string[]): Promise<string[]>;
  /** Null while no origin of files is configured: nothing is retried. */
  ingest: ((mediaId: string) => Promise<IngestOutcome>) | null;
}

export interface PurgeResult {
  destroyed: number;
  destroyFailed: number;
  waitingForStore: number;
  retried: number;
  /** Rows due for destruction that did not fit in this run's time: untouched, they wait for the next run. */
  destroyLeftForNextRun: number;
  /** Files due for a retry that did not fit in this run's time: untouched, they wait for the next run. */
  leftForNextRun: number;
}

type DestroyOutcome = "destroyed" | "failed" | "waiting";

async function destroyOne(deps: PurgeDeps, row: PurgeRow, now: Date): Promise<DestroyOutcome> {
  if (needsStoreRemoval(row.status)) {
    if (!deps.storeConfigured) return "waiting";
    const path = row.storagePath ?? mediaStoragePath(row.tenantId, row.id);
    // A stored path of another shape or business is never removed: it is reported and left for a person.
    if (!isPathOfTenant(path, row.tenantId)) {
      console.error("[wa-media-purge] stored path does not match its business", row.id);
      return "failed";
    }
    const removed = await deps.store.remove(path);
    if (!removed.ok) return "failed";
  }
  await deps.markDestroyed(row.id, row.status, now);
  return "destroyed";
}

export async function runMediaPurge(deps: PurgeDeps, now: Date, clock: RunClock): Promise<PurgeResult> {
  const result: PurgeResult = { destroyed: 0, destroyFailed: 0, waitingForStore: 0, retried: 0, destroyLeftForNextRun: 0, leftForNextRun: 0 };
  const due = await deps.listDue(now, PURGE_BATCH);
  for (let index = 0; index < due.length; index += 1) {
    if (!fitsInRun(clock, DESTROY_SLOT_MS)) {
      result.destroyLeftForNextRun = due.length - index;
      return result;
    }
    const row = due[index];
    const outcome = await destroyOne(deps, row, now);
    if (outcome === "destroyed") result.destroyed += 1;
    else if (outcome === "failed") result.destroyFailed += 1;
    else result.waitingForStore += 1;
  }
  if (!deps.ingest || deps.enabledTenantIds.length === 0) return result;
  const retryable = await deps.listRetryable(now, RETRY_IDLE_MS, RETRY_BATCH, deps.enabledTenantIds);
  for (let index = 0; index < retryable.length; index += 1) {
    if (!fitsInRun(clock, FILE_SLOT_MS)) {
      result.leftForNextRun = retryable.length - index;
      break;
    }
    await deps.ingest(retryable[index]);
    result.retried += 1;
  }
  return result;
}
