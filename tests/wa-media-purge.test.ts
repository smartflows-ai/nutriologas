// tests/wa-media-purge.test.ts
// Ticket #182: the end of the 15-minute job destroys the copies that are due (day 30, hidden or not, deleted chats)
// and retries the files still to fetch. Everything is injected: no database, no store, no clock of its own.
// Run with: npx tsx --test tests/wa-media-purge.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { DESTROY_SLOT_MS, FILE_SLOT_MS, RETRY_IDLE_MS, RUN_DEADLINE_MS, retryCutoff, runMediaPurge, type PurgeDeps, type RunClock } from "../src/lib/wa-media-purge";
import type { PurgeRow } from "../src/lib/wa-media-data";
import type { MediaStore } from "../src/lib/wa-media-storage";

const TENANT = "0b6f1a52-6a7e-4f43-9d55-1c1f0e7a9a11";
const ID_A = "5e8f2a10-9c3b-4d7e-8f61-2a3b4c5d6e7f";
const ID_B = "6a9f3b21-0d4c-4e8f-9a72-3b4c5d6e7f80";
const NOW = new Date("2026-12-31T18:00:00Z");
const OTHER = "7d2c9e10-3b4a-4c5d-8e6f-a1b2c3d4e5f6";
/** A run that just started: every file fits. */
const FRESH: RunClock = { elapsedMs: () => 0 };

function deps(
  options: { due?: PurgeRow[]; removeFails?: string[]; storeConfigured?: boolean; retryable?: string[]; withIngest?: boolean; enabled?: string[] } = {},
) {
  const calls: string[] = [];
  const lists: string[] = [];
  const store: MediaStore = {
    async put() {
      return { ok: true, value: undefined };
    },
    async signedUrl() {
      return { ok: false, error: "not_configured" };
    },
    async remove(path) {
      calls.push(`remove:${path}`);
      return options.removeFails?.includes(path) ? { ok: false, error: "store_failed" } : { ok: true, value: undefined };
    },
  };
  const value: PurgeDeps = {
    store,
    storeConfigured: options.storeConfigured ?? true,
    async listDue() {
      return options.due ?? [];
    },
    async markDestroyed(id, status) {
      calls.push(`destroyed:${id}:${status}`);
    },
    enabledTenantIds: options.enabled ?? [TENANT],
    async listRetryable(_now, _idle, _limit, tenantIds) {
      lists.push(tenantIds.join(","));
      return options.retryable ?? [];
    },
    ingest:
      options.withIngest === false
        ? null
        : async (id) => {
            calls.push(`ingest:${id}`);
            return "stored";
          },
  };
  return { deps: value, calls, lists };
}

test("a stored copy that is due is removed from the store, then marked destroyed", async () => {
  const { deps: d, calls } = deps({ due: [{ id: ID_A, tenantId: TENANT, status: "STORED", storagePath: `${TENANT}/${ID_A}` }] });
  const result = await runMediaPurge(d, NOW, FRESH);
  assert.deepEqual(calls, [`remove:${TENANT}/${ID_A}`, `destroyed:${ID_A}:STORED`]);
  assert.equal(result.destroyed, 1);
});

test("a row that never reached the store is closed without asking the store (and loses the person's data)", async () => {
  for (const status of ["RECEIVED", "TOO_LARGE", "VIEW_ONCE", "SIZE_UNKNOWN", "CONTACT_LIMIT", "TENANT_LIMIT", "PLATFORM_LIMIT"] as const) {
    const { deps: d, calls } = deps({ due: [{ id: ID_A, tenantId: TENANT, status, storagePath: null }] });
    await runMediaPurge(d, NOW, FRESH);
    assert.deepEqual(calls, [`destroyed:${ID_A}:${status}`], status);
  }
});

test("a failed file is removed at its computed path, in case an upload left a copy nobody knew of", async () => {
  const { deps: d, calls } = deps({ due: [{ id: ID_A, tenantId: TENANT, status: "FAILED", storagePath: null }] });
  await runMediaPurge(d, NOW, FRESH);
  assert.deepEqual(calls, [`remove:${TENANT}/${ID_A}`, `destroyed:${ID_A}:FAILED`]);
});

test("when removing fails the row is kept as it is and tried again on the next run", async () => {
  const { deps: d, calls } = deps({
    due: [
      { id: ID_A, tenantId: TENANT, status: "STORED", storagePath: `${TENANT}/${ID_A}` },
      { id: ID_B, tenantId: TENANT, status: "STORED", storagePath: `${TENANT}/${ID_B}` },
    ],
    removeFails: [`${TENANT}/${ID_A}`],
  });
  const result = await runMediaPurge(d, NOW, FRESH);
  assert.ok(!calls.includes(`destroyed:${ID_A}:STORED`));
  assert.ok(calls.includes(`destroyed:${ID_B}:STORED`));
  assert.equal(result.destroyFailed, 1);
  assert.equal(result.destroyed, 1);
});

test("without a configured store a copy is never marked destroyed: it waits", async () => {
  const { deps: d, calls } = deps({ storeConfigured: false, due: [{ id: ID_A, tenantId: TENANT, status: "STORED", storagePath: `${TENANT}/${ID_A}` }] });
  const result = await runMediaPurge(d, NOW, FRESH);
  assert.deepEqual(calls, []);
  assert.equal(result.waitingForStore, 1);
});

test("a stored path that does not belong to the row's business is never removed (it is reported)", async () => {
  const other = "7d2c9e10-3b4a-4c5d-8e6f-a1b2c3d4e5f6";
  const { deps: d, calls } = deps({ due: [{ id: ID_A, tenantId: TENANT, status: "STORED", storagePath: `${other}/${ID_A}` }] });
  const result = await runMediaPurge(d, NOW, FRESH);
  assert.deepEqual(calls, []);
  assert.equal(result.destroyFailed, 1);
});

test("files still to fetch are retried only when an origin exists", async () => {
  const withOrigin = deps({ retryable: [ID_A, ID_B] });
  assert.equal((await runMediaPurge(withOrigin.deps, NOW, FRESH)).retried, 2);
  assert.deepEqual(withOrigin.calls, [`ingest:${ID_A}`, `ingest:${ID_B}`]);
  assert.deepEqual(withOrigin.lists, [TENANT]);
  const noOrigin = deps({ retryable: [ID_A], withIngest: false });
  assert.equal((await runMediaPurge(noOrigin.deps, NOW, FRESH)).retried, 0);
  assert.deepEqual(noOrigin.calls, []);
});

test("only businesses that are on are retried; with none on, nothing is even listed", async () => {
  const some = deps({ retryable: [ID_A], enabled: [TENANT, OTHER] });
  await runMediaPurge(some.deps, NOW, FRESH);
  assert.deepEqual(some.lists, [`${TENANT},${OTHER}`]);
  const none = deps({ retryable: [ID_A], enabled: [] });
  const result = await runMediaPurge(none.deps, NOW, FRESH);
  assert.deepEqual(none.calls, []);
  assert.deepEqual(none.lists, []);
  assert.equal(result.retried, 0);
});

test("destruction runs for every business, also those that are off", async () => {
  const { deps: d, calls } = deps({ enabled: [], due: [{ id: ID_A, tenantId: OTHER, status: "STORED", storagePath: `${OTHER}/${ID_A}` }] });
  const result = await runMediaPurge(d, NOW, FRESH);
  assert.deepEqual(calls, [`remove:${OTHER}/${ID_A}`, `destroyed:${ID_A}:STORED`]);
  assert.equal(result.destroyed, 1);
});

test("the round is tied to the run's clock: a file starts only if its whole slot fits before the deadline", async () => {
  let elapsed = RUN_DEADLINE_MS - FILE_SLOT_MS - 1;
  const clock: RunClock = { elapsedMs: () => elapsed };
  const { deps: d, calls } = deps({ retryable: [ID_A, ID_B] });
  d.ingest = async (id) => {
    calls.push(`ingest:${id}`);
    elapsed += 2;
    return "stored";
  };
  const result = await runMediaPurge(d, NOW, clock);
  assert.deepEqual(calls.filter((c) => c.startsWith("ingest:")), [`ingest:${ID_A}`]);
  assert.equal(result.retried, 1);
  assert.equal(result.leftForNextRun, 1);
});

test("a file that was not started for lack of time is not touched: it uses no attempt", async () => {
  const late: RunClock = { elapsedMs: () => RUN_DEADLINE_MS };
  const { deps: d, calls } = deps({ retryable: [ID_A] });
  const result = await runMediaPurge(d, NOW, late);
  assert.ok(!calls.some((c) => c.startsWith("ingest:")));
  assert.equal(result.leftForNextRun, 1);
});

test("the budget leaves room inside the 60 s limit of the workflow node", () => {
  assert.equal(RUN_DEADLINE_MS, 45_000);
  assert.equal(FILE_SLOT_MS, 20_000);
  assert.ok(RUN_DEADLINE_MS < 60_000);
});

test("destruction is under the run's clock too: a row starts only if its slot fits, the rest waits and is counted apart", async () => {
  let elapsed = RUN_DEADLINE_MS - DESTROY_SLOT_MS - 1;
  const clock: RunClock = { elapsedMs: () => elapsed };
  const { deps: d, calls } = deps({
    due: [
      { id: ID_A, tenantId: TENANT, status: "STORED", storagePath: `${TENANT}/${ID_A}` },
      { id: ID_B, tenantId: TENANT, status: "STORED", storagePath: `${TENANT}/${ID_B}` },
    ],
    retryable: [ID_A],
  });
  const remove = d.store.remove;
  d.store = { ...d.store, remove: async (path) => ((elapsed += 2), remove(path)) };
  const result = await runMediaPurge(d, NOW, clock);
  assert.deepEqual(calls, [`remove:${TENANT}/${ID_A}`, `destroyed:${ID_A}:STORED`]);
  assert.equal(result.destroyed, 1);
  assert.equal(result.destroyLeftForNextRun, 1);
  assert.equal(result.retried, 0, "no time left for retries either");
});

test("a deferred file is retried in the next round: idle 2 minutes is listed, 20 seconds is not", () => {
  assert.equal(RETRY_IDLE_MS, 60_000);
  const cutoff = retryCutoff(NOW, RETRY_IDLE_MS);
  const twoMinutesAgo = new Date(NOW.getTime() - 2 * 60_000);
  const twentySecondsAgo = new Date(NOW.getTime() - 20_000);
  assert.ok(twoMinutesAgo.getTime() <= cutoff.getTime());
  assert.ok(twentySecondsAgo.getTime() > cutoff.getTime());
});
