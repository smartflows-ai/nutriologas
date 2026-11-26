// tests/unsupported-media-wiring.test.ts
// Ticket #139: bot/media is internal, takes the tenant from the instance, never reads the file, raises the hand-off
// from the server without pausing the bot, and whatsapp/sync stores the markers through the tested function.
// Reads the source (no database). Run with: npx tsx --test tests/unsupported-media-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8");
const MEDIA = read("src/app/api/internal/bot/media/route.ts");
const SYNC = read("src/app/api/internal/whatsapp/sync/route.ts");
const HANDLER = read("src/lib/help-handler.ts");
const TEAM_DATA = read("src/lib/team-numbers-data.ts");
const CONTACT_STATUS = read("src/app/api/internal/bot/contact-status/route.ts");

test("bot/media checks the internal key and takes the tenant from the WhatsApp instance", () => {
  assert.match(MEDIA, /isInternalKeyValid\(req\)/);
  assert.match(MEDIA, /resolveBotTenant\(instance\)/);
  assert.equal(/tenantId\s*[:=]\s*body/.test(MEDIA), false);
});

test("bot/media never reads the file: no base64, no media content, only the type", () => {
  assert.doesNotMatch(MEDIA, /base64|eventData|\.message\b/);
  assert.match(MEDIA, /classifyInbound\(messageType\)/);
});

test("a silent type returns ignore before anything is raised", () => {
  const ignoreAt = MEDIA.indexOf('action: "ignore"');
  assert.ok(ignoreAt > 0);
  assert.ok(ignoreAt < MEDIA.indexOf("raiseHelpForContact("), "the silent types never raise");
});

test("the hand-off is raised by the server with its own reason and a failure still answers the patient", () => {
  assert.match(MEDIA, /raiseHelpForContact\(bot, \{ remoteJid, remoteJidAlt \}, "unsupported_media"\)/);
  assert.match(MEDIA, /catch \(error\)/);
  assert.match(MEDIA, /shouldReplyToMedia\(/);
  // #182 (R10) adds the storage notice as a third argument; the language and the business name stay the first two.
  assert.match(MEDIA, /mediaReplyText\(bot\.messageLanguage, bot\.tenantName[,)]/);
});

test("bot/media applies the same guards as the normal flow before it raises or answers anything", () => {
  const gateAt = MEDIA.indexOf("mediaGate(");
  assert.ok(gateAt > 0, "bot/media calls mediaGate");
  assert.ok(gateAt < MEDIA.indexOf("raiseHelpForContact("), "the gate comes before the hand-off");
  assert.match(MEDIA, /isTeamNumber\(/);
  assert.match(MEDIA, /loadTeamNumbers\(bot\.tenantId\)/);
  assert.match(MEDIA, /botEnabled/);
  assert.match(MEDIA, /optedOutAt/);
});

test("the team numbers come from one place shared with contact-status, scoped to the business and to active staff", () => {
  assert.match(TEAM_DATA, /export async function loadTeamNumbers\(/);
  assert.match(TEAM_DATA, /tenantId/);
  assert.match(TEAM_DATA, /role: "STAFF"/);
  assert.match(TEAM_DATA, /isActive: true/);
  assert.match(CONTACT_STATUS, /loadTeamNumbers\(bot\.tenantId\)/);
  assert.doesNotMatch(CONTACT_STATUS, /role: "STAFF"/, "contact-status no longer repeats the staff query");
  assert.match(CONTACT_STATUS, /isTeamNumber\(/);
});

test("the dedupe looks only at this business's chats", () => {
  assert.match(MEDIA, /tenantId: bot\.tenantId/);
});

test("the model cannot ask for the media reason through bot/help", () => {
  assert.match(HANDLER, /SERVER_ONLY_REASONS[^;]*"unsupported_media"/);
});

test("whatsapp/sync stores the line of a message through messageContentOf", () => {
  assert.match(SYNC, /messageContentOf\(data\.message\)/);
  assert.doesNotMatch(SYNC, /\[Mensaje Multimedia\]/);
});
