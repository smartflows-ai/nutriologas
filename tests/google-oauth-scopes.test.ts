// The Google connection asks only for what the product uses. Scopes that no code needs must not come back: each sensitive
// scope adds to Google's review and keeps the "app not verified" screen for every user.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const START = readFileSync(path.join(ROOT, "src/app/api/apps/oauth/google/start/route.ts"), "utf8").replace(/\r\n/g, "\n");

function requestedScopes(source: string): string[] {
  const block = /const scopes = \[([\s\S]*?)\]\.join/.exec(source);
  assert.ok(block, "the scopes list exists in the start route");
  return Array.from(block[1].matchAll(/"(https:\/\/www\.googleapis\.com\/auth\/[^"]+)"/g), (m) => m[1]);
}

test("the connection requests exactly the scopes the product uses, nothing else", () => {
  assert.deepEqual(requestedScopes(START).sort(), [
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ]);
});

test("spreadsheets.readonly is not requested (no code uses Sheets)", () => {
  const scopes = requestedScopes(START);
  assert.equal(scopes.includes("https://www.googleapis.com/auth/spreadsheets.readonly"), false);
});

test("the broad calendar scopes are never requested (calendar.events and calendar.calendarlist.readonly are enough)", () => {
  const scopes = requestedScopes(START);
  assert.equal(scopes.includes("https://www.googleapis.com/auth/calendar"), false);
  assert.equal(scopes.includes("https://www.googleapis.com/auth/calendar.readonly"), false);
});
