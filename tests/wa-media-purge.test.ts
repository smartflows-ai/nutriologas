// tests/wa-media-purge.test.ts
// Ticket #182: the end of the 15-minute job destroys the copies that are due (day 30, hidden or not, deleted chats)
// and retries the files still to fetch. Everything is injected: no database, no store, no clock of its own.
// Run with: npx tsx --test tests/wa-media-purge.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { runMediaPurge, type PurgeDeps } from "../src/lib/wa-media-purge";
import type { PurgeRow } from "../src/lib/wa-media-data";
import type { MediaStore } from "../src/lib/wa-media-storage";

const TENANT = "0b6f1a52-6a7e-4f43-9d55-1c1f0e7a9a11";
const ID_A = "5e8f2a10-9c3b-4d7e-8f61-2a3b4c5d6e7f";
const ID_B = "6a9f3b21-0d4c-4e8f-9a72-3b4c5d6e7f80";
const NOW = new Date("2026-12-31T18:00:00Z");

function deps(options: { due?: PurgeRow[]; removeFails?: string[]; storeConfigured?: boolean; retryable?: string[]; withIngest?: boolean } = {}) {
  const calls: string[] = [];
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
    async listRetryable() {
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
  return { deps: value, calls };
}

test("a stored copy that is due is removed from the store, then marked destroyed", async () => {
  const { deps: d, calls } = deps({ due: [{ id: ID_A, tenantId: TENANT, status: "STORED", storagePath: `${TENANT}/${ID_A}` }] });
  const result = await runMediaPurge(d, NOW);
  assert.deepEqual(calls, [`remove:${TENANT}/${ID_A}`, `destroyed:${ID_A}:STORED`]);
  assert.equal(result.destroyed, 1);
});

test("a row that never reached the store is closed without asking the store (and loses the person's data)", async () => {
  for (const status of ["RECEIVED", "TOO_LARGE", "VIEW_ONCE", "SIZE_UNKNOWN", "CONTACT_LIMIT", "TENANT_LIMIT", "PLATFORM_LIMIT"] as const) {
    const { deps: d, calls } = deps({ due: [{ id: ID_A, tenantId: TENANT, status, storagePath: null }] });
    await runMediaPurge(d, NOW);
    assert.deepEqual(calls, [`destroyed:${ID_A}:${status}`], status);
  }
});

test("a failed file is removed at its computed path, in case an upload left a copy nobody knew of", async () => {
  const { deps: d, calls } = deps({ due: [{ id: ID_A, tenantId: TENANT, status: "FAILED", storagePath: null }] });
  await runMediaPurge(d, NOW);
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
  const result = await runMediaPurge(d, NOW);
  assert.ok(!calls.includes(`destroyed:${ID_A}:STORED`));
  assert.ok(calls.includes(`destroyed:${ID_B}:STORED`));
  assert.equal(result.destroyFailed, 1);
  assert.equal(result.destroyed, 1);
});

test("without a configured store a copy is never marked destroyed: it waits", async () => {
  const { deps: d, calls } = deps({ storeConfigured: false, due: [{ id: ID_A, tenantId: TENANT, status: "STORED", storagePath: `${TENANT}/${ID_A}` }] });
  const result = await runMediaPurge(d, NOW);
  assert.deepEqual(calls, []);
  assert.equal(result.waitingForStore, 1);
});

test("a stored path that does not belong to the row's business is never removed (it is reported)", async () => {
  const other = "7d2c9e10-3b4a-4c5d-8e6f-a1b2c3d4e5f6";
  const { deps: d, calls } = deps({ due: [{ id: ID_A, tenantId: TENANT, status: "STORED", storagePath: `${other}/${ID_A}` }] });
  const result = await runMediaPurge(d, NOW);
  assert.deepEqual(calls, []);
  assert.equal(result.destroyFailed, 1);
});

test("files still to fetch are retried only when an origin exists", async () => {
  const withOrigin = deps({ retryable: [ID_A, ID_B] });
  assert.equal((await runMediaPurge(withOrigin.deps, NOW)).retried, 2);
  assert.deepEqual(withOrigin.calls, [`ingest:${ID_A}`, `ingest:${ID_B}`]);
  const noOrigin = deps({ retryable: [ID_A], withIngest: false });
  assert.equal((await runMediaPurge(noOrigin.deps, NOW)).retried, 0);
  assert.deepEqual(noOrigin.calls, []);
});
