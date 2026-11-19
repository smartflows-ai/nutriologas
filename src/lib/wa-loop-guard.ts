// src/lib/wa-loop-guard.ts
// Ban prevention B0: a conversation that runs like an automated loop must not keep the bot answering.
// Pure rules, no I/O. Tests: tests/wa-loop-guard.test.ts.
//
// Found in production on 2026-11-14: one external contact exchanged 598 messages in one day, median 6 seconds apart.
// Two signals pause the bot for that contact: a burst (many messages in a short window at a machine-like pace),
// and a cap on bot replies per hour. These are operational safeguards, not a guarantee against WhatsApp enforcement.

export const LOOP_WINDOW_MIN = 10;
export const LOOP_MIN_MESSAGES = 30;
export const LOOP_MAX_MEDIAN_GAP_SEC = 10;
export const HOURLY_BOT_REPLY_CAP = 60;

export type LoopMessage = { atMs: number; fromMe: boolean };
export type LoopVerdict = { paused: boolean; reason: "burst" | "hourly_cap" | null };

const MS_PER_MIN = 60 * 1000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Decides whether the bot must stop answering this contact. `messages` are the contact's messages from the last hour
 * (both directions), in any order. `nowMs` is the instant of the check.
 */
export function detectRunaway(messages: LoopMessage[], nowMs: number): LoopVerdict {
  const hour = messages.filter((m) => m.atMs > nowMs - 60 * MS_PER_MIN && m.atMs <= nowMs);
  const repliesInHour = hour.filter((m) => m.fromMe).length;
  if (repliesInHour > HOURLY_BOT_REPLY_CAP) return { paused: true, reason: "hourly_cap" };

  const window = hour
    .filter((m) => m.atMs > nowMs - LOOP_WINDOW_MIN * MS_PER_MIN)
    .map((m) => m.atMs)
    .sort((a, b) => a - b);
  if (window.length < LOOP_MIN_MESSAGES) return { paused: false, reason: null };

  const gaps: number[] = [];
  for (let i = 1; i < window.length; i++) gaps.push((window[i] - window[i - 1]) / 1000);
  if (median(gaps) < LOOP_MAX_MEDIAN_GAP_SEC) return { paused: true, reason: "burst" };
  return { paused: false, reason: null };
}
