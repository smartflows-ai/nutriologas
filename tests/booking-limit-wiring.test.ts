// tests/booking-limit-wiring.test.ts
// Ticket #141: the bot book route and the public web booking apply the visit limit at the right place, the count is scoped to the business and
// skips deleted visits, and the hand-off is raised by the server. Reads the source (no database), like
// tests/bot-visit-routes-wiring.test.ts. Run with: npx tsx --test tests/booking-limit-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8");
const BOOK = read("src/app/api/internal/bot/book/route.ts");
const RESCHEDULE = read("src/app/api/internal/bot/reschedule/route.ts");
const DATA = read("src/lib/booking-limit-data.ts");
const RULES = read("src/lib/booking-limit.ts");
const WEB = read("src/app/api/appointments/route.ts");
const HANDLER = read("src/lib/help-handler.ts");

test("bot/book checks the limit after every data validation and before creating anything", () => {
  const checkAt = BOOK.indexOf("checkVisitLimit(");
  assert.ok(checkAt > 0, "bot/book calls checkVisitLimit");
  assert.ok(checkAt > BOOK.indexOf("full_name_required"), "after the name check");
  assert.ok(checkAt > BOOK.indexOf("buildSlot("), "after the slot is valid");
  assert.ok(checkAt < BOOK.indexOf("prisma.user.create("), "before the guest account is created");
  assert.ok(checkAt < BOOK.indexOf("createAppointment({"), "before the visit is created");
});

test("bot/book hands the chat over from the server with its own reason, not through the model", () => {
  assert.match(BOOK, /handOffOverLimit\(bot, customerPhone\)/);
  assert.match(DATA, /raiseHelpForContact\(bot, \{ customerPhone \}, "booking_limit"\)/);
  assert.match(BOOK, /visitLimitBody\(/);
  assert.match(BOOK, /status: 409/);
});

test("the count is scoped to the business, skips deleted visits and counts only active ones", () => {
  assert.match(DATA, /tenantId/);
  assert.match(DATA, /deletedAt: null/);
  assert.match(DATA, /ACTIVE_VISIT_STATUSES/);
  assert.match(RULES, /referredByKey/, "the person writing is counted for the visits booked for others");
  assert.match(DATA, /import \{ prisma \} from "@\/lib\/db"/);
});

test("a database failure while handing over is caught: the agent still gets the refusal, told not to promise a person", () => {
  assert.match(DATA, /export async function handOffOverLimit\(/);
  assert.match(DATA, /catch \(error\)/);
  assert.match(DATA, /return false/);
});

test("the count uses visitScopes, so the person writing is always counted for the visits they booked for others", () => {
  assert.match(DATA, /visitScopes\(/);
  assert.doesNotMatch(DATA, /: patient;/, "the writer count is never copied from the patient count");
});

test("bot/reschedule has NO limit: moving a visit does not add one, and old data over the limit must not block a change of time", () => {
  assert.doesNotMatch(RESCHEDULE, /checkVisitLimit|visitLimitBody|handOffOverLimit|booking-limit/);
});

test("the public web booking refuses the fourth visit before creating anything, with a coded 409 and no hand-off", () => {
  const checkAt = WEB.indexOf("checkWebVisitLimit(");
  assert.ok(checkAt > 0, "POST /api/appointments calls checkWebVisitLimit");
  assert.ok(checkAt > WEB.indexOf("createFromPanel("), "the panel booking has no limit");
  assert.ok(checkAt > WEB.indexOf("phone_required"), "after the phone is known");
  assert.ok(checkAt < WEB.indexOf("prisma.user.create("), "before the guest account is created");
  assert.ok(checkAt < WEB.indexOf("createAppointment({"), "before the visit is created");
  assert.match(WEB, /apiError\("visit_limit_reached", 409\)/);
  assert.doesNotMatch(WEB, /handOffOverLimit/, "no chat to pause on the web");
  assert.match(WEB, /tenantId/);
});

test("the web screen shows the limit text from i18n, not a generic error", () => {
  const FLOW = read("src/components/shop/BookingFlow.tsx");
  assert.match(FLOW, /translateApiError\(t, data\.error\)/);
  for (const file of ["es", "en"]) assert.match(read(`src/i18n/${file}.ts`), /visit_limit_reached:/);
});

test("the help hand-off core is shared and bot/help cannot be asked for the limit reason", () => {
  assert.match(HANDLER, /export async function raiseHelpForContact\(/);
  assert.match(HANDLER, /await raiseHelpForContact\(bot,/, "handleHelpRequest uses the shared core");
  assert.match(HANDLER, /SERVER_ONLY_REASONS[^;]*"booking_limit"/);
});
