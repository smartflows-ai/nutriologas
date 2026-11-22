// tests/business-phone-wiring.test.ts
// Ticket #148: bot/book gives resolveBookingPhone the business's own numbers (the profile number and the connected
// line), and resolveBotTenant loads both. Reads the source (no database), like tests/bot-visit-routes-wiring.test.ts.
// Run with: npx tsx --test tests/business-phone-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8");
const BOT_LIB = read("src/lib/bot.ts");
const BOOK = read("src/app/api/internal/bot/book/route.ts");

test("resolveBotTenant loads the profile number and the connected line and exposes them as businessPhones", () => {
  assert.match(BOT_LIB, /whatsappNumber: true/);
  assert.match(BOT_LIB, /waPhoneNumber: true/);
  assert.match(BOT_LIB, /businessPhones: \[app\.tenant\.whatsappNumber, app\.waPhoneNumber\]/);
});

test("bot/book passes the business numbers to resolveBookingPhone and answers business_phone with a message for the agent", () => {
  assert.match(BOOK, /resolveBookingPhone\(String\(customerPhone\), patientPhone, bot\.businessPhones\)/);
  assert.match(BOOK, /business_phone/);
});
