// tests/wa-loop-guard-wiring.test.ts
// Ban prevention B0: the bot's contact check runs the loop guard before answering, and pauses only that contact.
// Reads the source (no database). Run: npx tsx --test tests/wa-loop-guard-wiring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const ROUTE = readFileSync(path.join(ROOT, "src/app/api/internal/bot/contact-status/route.ts"), "utf8").replace(/\r\n/g, "\n");

test("the contact check reads the last hour of messages and runs the loop guard", () => {
  assert.match(ROUTE, /prisma\.whatsAppMessage\.findMany/);
  assert.match(ROUTE, /detectRunaway\(/);
});

test("a paused loop turns the bot off for that contact with the loop_guard reason", () => {
  assert.match(ROUTE, /botPausedReason: "loop_guard"/);
  assert.match(ROUTE, /reason: "loop_guard"/);
});

test("the owner is told only when the pause actually happens", () => {
  assert.match(ROUTE, /if \(paused\.count > 0\)/);
  assert.match(ROUTE, /notifyTenantOwner\(/);
});
