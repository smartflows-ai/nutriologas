// src/lib/wa-media-purge.ts
// Ticket #182, plan R5 and section 4 step 7: run at the end of the 15-minute job (reminders/run), in its own error
// block. Destroys the copies that are due (their 30th day, hidden or not; a deleted chat) and retries the files
// still to fetch. A copy is marked destroyed only after the store removed it: if removing fails, the row stays as it
// is and the next run tries again. Everything outside is injected (tests/wa-media-purge.test.ts).
import { isPathOfTenant, mediaStoragePath, needsStoreRemoval, type MediaStatus } from "@/lib/wa-media-rules";
import type { IngestOutcome } from "@/lib/wa-media-ingest";
import type { PurgeRow } from "@/lib/wa-media-data";
import type { MediaStore } from "@/lib/wa-media-storage";

/** Rows destroyed per run; the rest wait for the next one, 15 minutes later. */
export const PURGE_BATCH = 50;
/** Files retried per run. */
export const RETRY_BATCH = 20;
/** A file is retried only after this long without changes, so a fetch in progress is not repeated. */
export const RETRY_IDLE_MS = 10 * 60 * 1000;

export interface PurgeDeps {
  store: MediaStore;
  storeConfigured: boolean;
  listDue(now: Date, limit: number): Promise<PurgeRow[]>;
  markDestroyed(mediaId: string, status: MediaStatus, at: Date): Promise<void>;
  listRetryable(now: Date, idleMs: number, limit: number): Promise<string[]>;
  /** Null while no origin of files is configured: nothing is retried. */
  ingest: ((mediaId: string) => Promise<IngestOutcome>) | null;
}

export interface PurgeResult {
  destroyed: number;
  destroyFailed: number;
  waitingForStore: number;
  retried: number;
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

export async function runMediaPurge(deps: PurgeDeps, now: Date): Promise<PurgeResult> {
  const result: PurgeResult = { destroyed: 0, destroyFailed: 0, waitingForStore: 0, retried: 0 };
  for (const row of await deps.listDue(now, PURGE_BATCH)) {
    const outcome = await destroyOne(deps, row, now);
    if (outcome === "destroyed") result.destroyed += 1;
    else if (outcome === "failed") result.destroyFailed += 1;
    else result.waitingForStore += 1;
  }
  if (!deps.ingest) return result;
  for (const mediaId of await deps.listRetryable(now, RETRY_IDLE_MS, RETRY_BATCH)) {
    await deps.ingest(mediaId);
    result.retried += 1;
  }
  return result;
}
