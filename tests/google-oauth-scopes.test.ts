// The Google connection asks only for what the product uses. Restricted and sensitive scopes that are not used must not
// come back (they would need Google's extra review and keep the "app not verified" screen for every user).
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

test("the connection requests calendar.events, gmail.send and the account identity, nothing else", () => {
  assert.deepEqual(requestedScopes(START).sort(), [
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

// The calendar list needs a permission the connection no longer asks for; the owner email comes from userinfo instead.
const READERS = ["src/app/api/calendar/events/route.ts", "src/lib/external-calendar.ts"];

test("the calendar readers do not call the calendar list (it needs a permission the connection does not ask for)", () => {
  for (const rel of READERS) {
    const code = readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
    assert.equal(code.includes("calendarList"), false, rel);
    assert.ok(code.includes("https://www.googleapis.com/oauth2/v2/userinfo"), `${rel} reads the account email`);
  }
});
