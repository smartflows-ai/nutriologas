// tests/messaging-delivery.test.ts
// Ban prevention: idempotency, error classes and the circuit breaker. Run: npx tsx --test tests/messaging-delivery.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BREAKER_THRESHOLD,
  activeKillSwitch,
  breakerAfterFailure,
  breakerAfterSuccess,
  canAttempt,
  initialBreaker,
  isRetryable,
  resumeByPerson,
  statusAfterFailure,
} from "../src/lib/messaging/delivery";

test("a SENT message is never attempted again", () => {
  assert.equal(canAttempt({ status: "SENT", attempts: 1, maxAttempts: 5 }), false);
});

test("an UNKNOWN message is never resent blindly (it may have reached the customer)", () => {
  assert.equal(canAttempt({ status: "UNKNOWN", attempts: 1, maxAttempts: 5 }), false);
});

test("a QUEUED message can be attempted; a FAILED one only while attempts remain", () => {
  assert.equal(canAttempt({ status: "QUEUED", attempts: 0, maxAttempts: 3 }), true);
  assert.equal(canAttempt({ status: "FAILED", attempts: 2, maxAttempts: 3 }), true);
  assert.equal(canAttempt({ status: "FAILED", attempts: 3, maxAttempts: 3 }), false);
});

test("a missing setup is retryable once fixed; network and 5xx errors too; a 4xx client error is not", () => {
  assert.equal(isRetryable({ kind: "unavailable" }), true);
  assert.equal(isRetryable({ kind: "network" }), true);
  assert.equal(isRetryable({ kind: "server", status: 503 }), true);
  assert.equal(isRetryable({ kind: "client", status: 400 }), false);
});

test("a timeout before the request left is retryable; after it left, it is UNKNOWN and not retried", () => {
  assert.equal(isRetryable({ kind: "timeout", requestLeft: false }), true);
  assert.equal(statusAfterFailure({ kind: "timeout", requestLeft: true }), "UNKNOWN");
  assert.equal(isRetryable({ kind: "timeout", requestLeft: true }), false);
});

test("a retryable failure stays FAILED (the attempt cap decides when it stops)", () => {
  assert.equal(statusAfterFailure({ kind: "network" }), "FAILED");
});

test("a success resets the consecutive failure count", () => {
  let state = initialBreaker();
  state = breakerAfterFailure(state, { kind: "network" });
  state = breakerAfterFailure(state, { kind: "network" });
  assert.equal(breakerAfterSuccess(state).consecutiveFailures, 0);
});

test("the breaker opens after the threshold of consecutive failures", () => {
  let state = initialBreaker();
  for (let i = 0; i < BREAKER_THRESHOLD - 1; i++) state = breakerAfterFailure(state, { kind: "network" });
  assert.equal(state.open, false);
  state = breakerAfterFailure(state, { kind: "network" });
  assert.equal(state.open, true);
  assert.equal(state.reason, "consecutive_failures");
});

test("an auth error or a logged-out session opens the breaker at once: a possible restriction", () => {
  assert.equal(breakerAfterFailure(initialBreaker(), { kind: "auth", status: 401 }).open, true);
  assert.equal(breakerAfterFailure(initialBreaker(), { kind: "logged_out" }).reason, "logged_out");
});

test("an open breaker stays open; a success does not close it", () => {
  const open = breakerAfterFailure(initialBreaker(), { kind: "auth", status: 403 });
  assert.equal(breakerAfterSuccess(open).open, true);
});

test("only a person who reviewed the cause resumes the breaker; nothing resumes it by itself", () => {
  const open = breakerAfterFailure(initialBreaker(), { kind: "logged_out" });
  assert.equal(resumeByPerson(open, null).open, true);
  assert.equal(resumeByPerson(open, "owner-review").open, false);
});

test("the kill switch scope shown is the widest one that is on", () => {
  assert.equal(activeKillSwitch({ global: true, tenant: true, instance: true }), "GLOBAL");
  assert.equal(activeKillSwitch({ global: false, tenant: true, instance: true }), "TENANT");
  assert.equal(activeKillSwitch({ global: false, tenant: false, instance: true }), "INSTANCE");
  assert.equal(activeKillSwitch({ global: false, tenant: false, instance: false }), null);
});
