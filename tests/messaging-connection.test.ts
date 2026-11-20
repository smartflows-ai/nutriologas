// tests/messaging-connection.test.ts
// Ban prevention: connection events from Evolution. Run: npx tsx --test tests/messaging-connection.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionEffectOf, connectionPatchOf, resumePatch } from "../src/lib/messaging/connection";

const NOW = new Date("2026-11-20T15:00:00Z");

test("an open connection records the time and nothing else", () => {
  const effect = connectionEffectOf({ state: "open" });
  assert.deepEqual(effect, { kind: "connected" });
  assert.deepEqual(connectionPatchOf(effect, NOW), { lastConnectedAt: NOW });
});

test("a logout (401) is a possible restriction: the instance is paused, not declared banned", () => {
  const effect = connectionEffectOf({ state: "close", statusCode: 401 });
  assert.equal(effect.kind, "possible_restriction");
  const patch = connectionPatchOf(effect, NOW);
  assert.equal(patch.riskState, "SENDING_PAUSED");
  assert.equal(patch.statusReason, "possible_restriction:401");
  assert.equal(patch.sendingPausedAt, NOW);
});

test("a forbidden (403) is also a possible restriction", () => {
  assert.equal(connectionEffectOf({ state: "close", statusCode: 403 }).kind, "possible_restriction");
});

test("an ordinary disconnection is recorded but does not pause sending", () => {
  const effect = connectionEffectOf({ state: "close", statusCode: 515 });
  assert.equal(effect.kind, "disconnected");
  const patch = connectionPatchOf(effect, NOW);
  assert.equal(patch.riskState, undefined);
  assert.equal(patch.statusReason, "disconnected:515");
});

test("a close with no code is a plain disconnection", () => {
  assert.equal(connectionEffectOf({ state: "close" }).kind, "disconnected");
});

test("connecting is ignored", () => {
  assert.deepEqual(connectionPatchOf(connectionEffectOf({ state: "connecting" }), NOW), {});
});

test("an open event never clears a pause: only a person resumes", () => {
  const open = connectionPatchOf(connectionEffectOf({ state: "open" }), NOW);
  assert.equal("riskState" in open, false);
  assert.equal("sendingPausedAt" in open, false);
});

test("resume needs a reviewer; without one nothing is cleared", () => {
  assert.equal(resumePatch(null), null);
  assert.deepEqual(resumePatch("owner-review"), {
    riskState: "NORMAL",
    sendingPausedAt: null,
    consecutiveFailures: 0,
    statusReason: null,
  });
});
