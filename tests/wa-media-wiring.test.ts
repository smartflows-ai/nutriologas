// tests/wa-media-wiring.test.ts
// Ticket #182: the routes and the job call the media rules at the right place, scoped to the session's business,
// and never send anything. Reads the source (no database), like tests/booking-limit-wiring.test.ts.
// Run with: npx tsx --test tests/wa-media-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const file = (rel: string): string => path.join(__dirname, "..", rel);
const read = (rel: string): string => (existsSync(file(rel)) ? readFileSync(file(rel), "utf8") : "");

const LINK = read("src/app/api/apps/whatsapp/media/[id]/route.ts");
const HIDE = read("src/app/api/apps/whatsapp/media/[id]/hide/route.ts");
const RESTORE = read("src/app/api/apps/whatsapp/media/[id]/restore/route.ts");
const MESSAGES = read("src/app/api/apps/whatsapp/messages/route.ts");
const CHAT = read("src/app/api/apps/whatsapp/chats/[id]/route.ts");
const SYNC = read("src/app/api/internal/whatsapp/sync/route.ts");
const RUN = read("src/app/api/internal/reminders/run/route.ts");
const BOT_MEDIA = read("src/app/api/internal/bot/media/route.ts");
const NEXT_CONFIG = read("next.config.mjs");
const DATA = read("src/lib/wa-media-data.ts");
const SUMMARY = read("src/lib/wa-media-summary.ts");

test("the link route needs the chats permission and loads the file with the session's business", () => {
  assert.match(LINK, /requirePermission\("whatsapp\.chats"\)/);
  assert.match(LINK, /findMediaForTenant\(tenantId, /);
  assert.match(LINK, /decideMediaLink\(/);
  assert.match(LINK, /serverMediaStore\(\)/);
  assert.doesNotMatch(LINK, /searchParams\.get\("(name|filename|type)"\)/, "the download name never comes from the browser");
  assert.match(LINK, /no-store/, "a link is never cached");
});

test("hide and restore need the chats permission and write the trail with the session's user and role", () => {
  for (const route of [HIDE, RESTORE]) {
    assert.match(route, /requirePermission\("whatsapp\.chats"\)/);
    assert.match(route, /setMediaHidden\(tenantId, /);
    assert.match(route, /session\.user\.id/);
    assert.match(route, /role/);
  }
  assert.match(HIDE, /setMediaHidden\([^)]*true\)/);
  assert.match(RESTORE, /setMediaHidden\([^)]*false\)/);
  assert.match(DATA, /whatsAppMediaTrail\.create/);
});

test("the messages of a chat carry the summary of their file, sizes as numbers", () => {
  assert.match(MESSAGES, /mediaSummariesFor\(tenantId, /);
  assert.match(SUMMARY, /Number\(row\.sizeBytes\)/);
  assert.match(DATA, /summaryOf\(row, now\)/);
});

test("deleting a chat marks its files for destruction in the same transaction, before the chat is gone", () => {
  const mark = CHAT.indexOf("destructionRequestForChat(");
  const remove = CHAT.indexOf("whatsAppChat.delete(");
  assert.ok(mark > 0 && remove > 0 && mark < remove);
  assert.match(CHAT, /\$transaction\(/);
});

test("sync notes the file only for businesses that are on, and a media failure never breaks the sync", () => {
  assert.match(SYNC, /mediaEnabledFor\(tenantId\)/);
  assert.match(SYNC, /noteMediaFromSync\(/);
  assert.match(SYNC, /noteMediaFromSync\([\s\S]*?\.catch\(/);
});

test("the 15-minute job runs the media purge in its own error block, after the reminders", () => {
  assert.match(RUN, /runMediaPurge\(/);
  const block = RUN.slice(RUN.indexOf("async function runMediaChecks"));
  assert.match(block, /try \{[\s\S]*runMediaPurge[\s\S]*\} catch/);
});

test("the bot's media answer adds the storage line only for businesses that are on, with their privacy link", () => {
  assert.match(BOT_MEDIA, /mediaReplyText\(bot\.messageLanguage, bot\.tenantName, \{ storesFiles: mediaEnabledFor\(bot\.tenantId\), privacyUrl: bot\.privacyUrl \}\)/);
});

test("the page policy lets images, audio and video load from the store origin, read from the server variable", () => {
  assert.match(NEXT_CONFIG, /process\.env\.WA_MEDIA_STORE_ENDPOINT/);
  assert.match(NEXT_CONFIG, /withMediaStore\("img-src /);
  assert.match(NEXT_CONFIG, /withMediaStore\("media-src /);
  assert.match(NEXT_CONFIG, /url\.origin/, "only scheme, host and port, never a path or a key");
});

test("no media file of the app calls a send route or the bot", () => {
  for (const source of [LINK, HIDE, RESTORE, DATA]) {
    assert.doesNotMatch(source, /sendWhatsAppMessage|sendOutbound|bot\/media|whatsapp\/send/);
  }
});

test("a business that is off never reads the new tables from the panel (the plan: off shows only the marker)", () => {
  assert.match(MESSAGES, /mediaEnabledFor\(tenantId\)/);
  const gate = MESSAGES.indexOf("mediaEnabledFor(tenantId)");
  assert.ok(gate > 0 && gate < MESSAGES.indexOf("mediaSummariesFor("), "the switch is checked before the query");
  for (const route of [LINK, HIDE, RESTORE]) {
    const at = route.indexOf("mediaEnabledFor(tenantId)");
    assert.ok(at > 0, "the route checks the switch");
    assert.ok(at < route.search(/findMediaForTenant\(|setMediaHidden\(/), "before touching the table");
    assert.match(route, /whatsapp_media_not_found/);
  }
});

test("deleting a chat and the destruction job do not depend on the switch: a business turned off still destroys", () => {
  assert.doesNotMatch(CHAT, /mediaEnabledFor/);
  assert.doesNotMatch(RUN, /mediaEnabledFor/);
});
