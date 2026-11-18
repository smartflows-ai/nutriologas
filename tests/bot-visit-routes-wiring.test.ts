// tests/bot-visit-routes-wiring.test.ts
// Ticket #111: the bot routes describe a visit with the tested helper (src/lib/bot-visit-view.ts) and the
// time comes from one function (clinicTimeLabel). Reads the source (no database), like tests/team-api-wiring.test.ts.
// Run with: npx tsx --test tests/bot-visit-routes-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");

const BOT_DIR = "src/app/api/internal/bot";
const MY_APPOINTMENTS = read(`${BOT_DIR}/my-appointments/route.ts`);
const RESCHEDULE = read(`${BOT_DIR}/reschedule/route.ts`);
const BOOK = read(`${BOT_DIR}/book/route.ts`);
const CANCEL = read(`${BOT_DIR}/cancel/route.ts`);
const BOT_LIB = read("src/lib/bot.ts");
const AVAILABILITY = read(`${BOT_DIR}/availability/route.ts`);
const CONTEXT = read(`${BOT_DIR}/context/route.ts`);

test("my-appointments describes each visit with botVisitView and the tenant resolved from the instance", () => {
  assert.match(MY_APPOINTMENTS, /from "@\/lib\/bot-visit-view"/);
  assert.match(MY_APPOINTMENTS, /\.\.\.botVisitView\(a, bot\)/);
  // The extra tenant query is gone: the short-link tenant and the address come from resolveBotTenant.
  assert.doesNotMatch(MY_APPOINTMENTS, /prisma\.tenant\.findUnique/);
});

test("reschedule describes the moved visit with botVisitView, so an online visit keeps its link", () => {
  assert.match(RESCHEDULE, /from "@\/lib\/bot-visit-view"/);
  assert.match(RESCHEDULE, /\.\.\.botVisitView\(result\.appointment, bot\)/);
  // The answer no longer sends the office address to every visit.
  assert.doesNotMatch(RESCHEDULE, /location: bot\.locationText/);
});

test("book tells the bot the weekday and the zone of the new visit, on the business clock", () => {
  assert.match(BOOK, /weekday: clinicWeekdayOf\(slot\.start, bot\.timeZone\)/);
  assert.match(BOOK, /time: formatSlotTime\(slot\.start, bot\.timeZone\)/);
  assert.match(BOOK, /timeZoneLabel: bot\.timeZoneLabel/);
});

test("cancel names the cancelled visit on the business clock, with no link or address", () => {
  assert.match(CANCEL, /\.\.\.botVisitTime\(appointment\.appointmentDate, bot\)/);
  assert.doesNotMatch(CANCEL, /botVisitView/);
});

test("no bot route sends a visit time in UTC", () => {
  const routes = readdirSync(path.join(ROOT, BOT_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${BOT_DIR}/${entry.name}/route.ts`)
    .filter((rel) => {
      try {
        read(rel);
        return true;
      } catch {
        return false;
      }
    });
  assert.ok(routes.length > 0);
  for (const rel of routes) {
    assert.doesNotMatch(read(rel), /appointmentDate\.toISOString\(\)/, `${rel} sends appointmentDate in UTC`);
  }
});

test("formatSlotTime and the visit view share one time format (clinicTimeLabel)", () => {
  assert.match(BOT_LIB, /return clinicTimeLabel\(date, zone\)/);
});

test("the business zone reaches the bot: resolved from the tenant, in availability and in the context", () => {
  assert.match(BOT_LIB, /timeZone: true/);
  assert.match(BOT_LIB, /timeZoneLabel: timeZoneLabel\(timeZone, app\.tenant\.messageLanguage\)/);
  assert.match(BOT_LIB, /upcomingCalendarText\(businessHours, timeZone\)/);
  assert.match(AVAILABILITY, /timeZoneLabel: bot\.timeZoneLabel/);
  assert.doesNotMatch(AVAILABILITY, /America\/Mexico_City \(UTC-06:00\)/);
  assert.match(CONTEXT, /timeZoneLabel: bot\.timeZoneLabel/);
});

test("every slot the bot builds is read in the business zone", () => {
  for (const source of [BOOK, RESCHEDULE, AVAILABILITY]) {
    assert.doesNotMatch(source, /buildSlot\([^)]*businessHours\)/);
  }
});
