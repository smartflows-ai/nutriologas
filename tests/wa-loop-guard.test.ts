// tests/wa-loop-guard.test.ts
// Ban prevention B0: a contact whose conversation runs like an automated loop gets the bot paused.
// Run: npx tsx --test tests/wa-loop-guard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRunaway, LOOP_WINDOW_MIN, LOOP_MIN_MESSAGES, LOOP_MAX_MEDIAN_GAP_SEC, HOURLY_BOT_REPLY_CAP } from "../src/lib/wa-loop-guard";

const NOW = Date.parse("2026-11-14T18:00:00Z");
const SEC = 1000;
const MIN = 60 * SEC;

/** Messages every `gapSec`, alternating sides, ending at `NOW`. */
function exchange(count: number, gapSec: number, endAt = NOW): { atMs: number; fromMe: boolean }[] {
  return Array.from({ length: count }, (_, i) => ({
    atMs: endAt - (count - 1 - i) * gapSec * SEC,
    fromMe: i % 2 === 0,
  }));
}

test("the 14 November pattern (about 6 seconds apart, many messages) pauses the bot", () => {
  const messages = exchange(100, 6);
  assert.equal(messages.length >= LOOP_MIN_MESSAGES, true);
  assert.deepEqual(detectRunaway(messages, NOW), { paused: true, reason: "burst" });
});

test("a person chatting at a normal pace is not paused", () => {
  const messages = exchange(12, 50);
  assert.deepEqual(detectRunaway(messages, NOW), { paused: false, reason: null });
});

test("many messages with a slow median gap are not a burst", () => {
  const messages = exchange(LOOP_MIN_MESSAGES + 5, 20);
  assert.deepEqual(detectRunaway(messages, NOW), { paused: false, reason: null });
});

test("a burst that ended before the window does not pause the bot now", () => {
  const earlier = exchange(100, 6, NOW - 2 * 60 * MIN);
  assert.deepEqual(detectRunaway(earlier, NOW), { paused: false, reason: null });
});

test("the window is the last LOOP_WINDOW_MIN minutes", () => {
  assert.equal(LOOP_WINDOW_MIN, 10);
  assert.equal(LOOP_MAX_MEDIAN_GAP_SEC, 10);
});

test("more bot replies than the hourly cap pauses the bot, reason hourly_cap", () => {
  const replies = Array.from({ length: HOURLY_BOT_REPLY_CAP + 1 }, (_, i) => ({
    atMs: NOW - (HOURLY_BOT_REPLY_CAP - i) * 50 * SEC,
    fromMe: true,
  }));
  assert.deepEqual(detectRunaway(replies, NOW), { paused: true, reason: "hourly_cap" });
});

test("exactly the hourly cap is still allowed", () => {
  const replies = Array.from({ length: HOURLY_BOT_REPLY_CAP }, (_, i) => ({
    atMs: NOW - (HOURLY_BOT_REPLY_CAP - 1 - i) * 50 * SEC,
    fromMe: true,
  }));
  assert.deepEqual(detectRunaway(replies, NOW), { paused: false, reason: null });
});

test("no messages means nothing to pause", () => {
  assert.deepEqual(detectRunaway([], NOW), { paused: false, reason: null });
});

test("one slow gap does not hide a burst (the median decides)", () => {
  // 30 messages in the window: 28 gaps of 6 s and 1 of 60 s, median 6 s -> burst
  const messages = [
    ...exchange(29, 6, NOW - 60 * SEC),
    { atMs: NOW, fromMe: false },
  ];
  assert.equal(detectRunaway(messages, NOW).paused, true);
});
