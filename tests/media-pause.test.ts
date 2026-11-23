// tests/media-pause.test.ts
// Ticket #139, owner decision: a patient who sends an audio, image, video or document pauses the bot in that chat,
// and it stays with the assistant or the owner until they mark it handled. The single answer to the patient is still
// delivered: the bot's send path never reads the chat's pause. Run with: npx tsx --test tests/media-pause.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { HELP_REASONS, pausesBot } from "../src/lib/help-reasons";
import { ownerTookOverPatch, resumeBotPatch } from "../src/lib/help-actions";

const ROOT = path.join(__dirname, "..");
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");

test("a file pauses the bot, like the other reasons that need a person", () => {
  assert.equal(pausesBot("unsupported_media"), true);
  assert.equal(HELP_REASONS.unsupported_media.pausesBot, true);
});

test("the pause of a file is a hand-off pause: marking it handled turns the bot back on", () => {
  assert.deepEqual(resumeBotPatch("unsupported_media"), { botEnabled: true, botPausedReason: null });
});

test("a person writing into that pause keeps the bot off and the reason says a person is writing", () => {
  assert.deepEqual(ownerTookOverPatch("unsupported_media"), { botPausedReason: "owner_reply" });
});

test("the owner's own manual pause is still never lifted by marking a chat handled", () => {
  assert.deepEqual(resumeBotPatch("manual"), {});
});

test("bot/media raises the reason through the shared hand-off, which pauses and records the reason", () => {
  const media = read("src/app/api/internal/bot/media/route.ts");
  const handler = read("src/lib/help-handler.ts");
  assert.match(media, /raiseHelpForContact\(bot, \{ remoteJid, remoteJidAlt \}, "unsupported_media"\)/);
  assert.match(handler, /if \(pausesBot\(reason\)\)/);
  assert.match(handler, /botEnabled: false, botPausedReason: reason/);
});

test("the next files of the same chat are ignored once the bot is paused: still one answer", () => {
  const media = read("src/app/api/internal/bot/media/route.ts");
  assert.match(media, /botEnabled: chats\.every\(\(chat\) => chat\.botEnabled\)/);
  assert.ok(media.indexOf("mediaGate(") < media.indexOf("raiseHelpForContact("), "the gate is read before the hand-off");
});

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(path.join(dir, entry.name)) : /\.ts$/.test(entry.name) ? [path.join(dir, entry.name)] : [],
  );
}

test("the answer to the first file is delivered with the chat already paused: the bot's send path never reads the chat's pause", () => {
  const files = ["src/app/api/internal/whatsapp/send/route.ts", "src/lib/whatsapp.ts", ...sourceFiles("src/lib/messaging")];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /botEnabled|botPausedReason/, `${file} does not read the chat's bot pause`);
  }
});

test("the n8n answer to a file is sent by the send route, with the key of the incoming message", () => {
  const doc = read("n8n/docs/cambios-n8n-p0-bot-139-140-141.md");
  assert.match(doc, /\/api\/internal\/whatsapp\/send/);
  assert.match(doc, /'bot-media-' \+ \(\$\('Extract Message'\)\.first\(\)\.json\.eventData\?\.key\?\.id/);
});
