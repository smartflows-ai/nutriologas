// tests/time-zone-lookup.test.ts
// Ticket #111: the business time zone is detected from its address coordinates with Google's Time Zone API.
// Any failure returns null (the zone stays as it was) and never breaks saving the address. Network is injected.
// Run with: npx tsx --test tests/time-zone-lookup.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { lookupTimeZone, type TimeZoneLookupDeps } from "../src/lib/time-zone-lookup";

const KEY = "test-key-123";
const NOW = new Date("2026-11-18T12:00:00Z");

function deps(response: unknown, opts: { status?: number; throws?: Error; key?: string | undefined } = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  const d: TimeZoneLookupDeps = {
    apiKey: "key" in opts ? opts.key : KEY,
    now: () => NOW,
    log: (message) => logs.push(message),
    fetchJson: async (url) => {
      calls.push(url);
      if (opts.throws) throw opts.throws;
      return { status: opts.status ?? 200, body: response };
    },
  };
  return { d, calls, logs };
}

test("an address in Cancun gives America/Cancun", async () => {
  const { d, calls } = deps({ status: "OK", timeZoneId: "America/Cancun" });
  assert.equal(await lookupTimeZone(21.16, -86.85, d), "America/Cancun");
  assert.equal(calls.length, 1);
  const url = new URL(calls[0]);
  assert.equal(url.origin + url.pathname, "https://maps.googleapis.com/maps/api/timezone/json");
  assert.equal(url.searchParams.get("location"), "21.16,-86.85");
  assert.equal(url.searchParams.get("timestamp"), String(Math.floor(NOW.getTime() / 1000)));
  assert.equal(url.searchParams.get("key"), KEY);
});

test("Google answering without a zone, denying the key or over quota gives null", async () => {
  for (const status of ["ZERO_RESULTS", "REQUEST_DENIED", "OVER_QUERY_LIMIT", "INVALID_REQUEST", "UNKNOWN_ERROR"]) {
    const { d } = deps({ status });
    assert.equal(await lookupTimeZone(21.16, -86.85, d), null, status);
  }
});

test("an HTTP error, a network error or a timeout gives null", async () => {
  assert.equal(await lookupTimeZone(21.16, -86.85, deps({}, { status: 500 }).d), null);
  assert.equal(await lookupTimeZone(21.16, -86.85, deps({}, { throws: new Error("timeout") }).d), null);
});

test("a zone name that is not a real IANA zone gives null", async () => {
  assert.equal(await lookupTimeZone(21.16, -86.85, deps({ status: "OK", timeZoneId: "-05:00" }).d), null);
  assert.equal(await lookupTimeZone(21.16, -86.85, deps({ status: "OK", timeZoneId: 42 }).d), null);
});

test("without a key, or with impossible coordinates, Google is not called", async () => {
  const noKey = deps({ status: "OK", timeZoneId: "America/Cancun" }, { key: undefined });
  assert.equal(await lookupTimeZone(21.16, -86.85, noKey.d), null);
  assert.equal(noKey.calls.length, 0);

  for (const [lat, lng] of [[NaN, 0], [91, 0], [0, 181], [-91, 0]]) {
    const bad = deps({ status: "OK", timeZoneId: "America/Cancun" });
    assert.equal(await lookupTimeZone(lat, lng, bad.d), null);
    assert.equal(bad.calls.length, 0);
  }
});

test("the key and the raw answer never reach the log", async () => {
  const { d, logs } = deps({ status: "REQUEST_DENIED", error_message: "The provided API key is invalid." });
  await lookupTimeZone(21.16, -86.85, d);
  const failure = deps({}, { throws: new Error(`fetch failed for ...key=${KEY}`) });
  await lookupTimeZone(21.16, -86.85, failure.d);
  for (const line of [...logs, ...failure.logs]) {
    assert.doesNotMatch(line, new RegExp(KEY));
    assert.doesNotMatch(line, /API key is invalid/);
  }
  assert.ok(logs.some((line) => line.includes("REQUEST_DENIED")));
});
