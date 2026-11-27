// tests/unsupported-media.test.ts
// Ticket #139: a patient who sends an audio, image, video or document gets "write it to me" and the chat is marked
// as needing help, without pausing the bot. Everything else (stickers, reactions, location, contacts, unknown types)
// stays silent as before. Pure rules, no I/O. Run with: npx tsx --test tests/unsupported-media.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { MEDIA_REPLY_COOLDOWN_MINUTES, classifyInbound, mediaGate, mediaReplyText, shouldReplyToMedia } from "../src/lib/unsupported-media";

test("audio, image, video and document are files the bot cannot read", () => {
  for (const type of ["audioMessage", "imageMessage", "videoMessage", "documentMessage", "documentWithCaptionMessage"]) {
    assert.equal(classifyInbound(type), "file", type);
  }
});

test("view once (any of its three outer keys) and the round video note are files too (#182)", () => {
  for (const type of ["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension", "ptvMessage"]) {
    assert.equal(classifyInbound(type), "file", type);
  }
});

test("stickers, reactions, location, contacts and unknown types stay silent (out of scope for this wave)", () => {
  for (const type of [
    "stickerMessage",
    "reactionMessage",
    "protocolMessage",
    "senderKeyDistributionMessage",
    "locationMessage",
    "liveLocationMessage",
    "contactMessage",
    "contactsArrayMessage",
    "pollCreationMessage",
    "somethingNewMessage",
    "",
  ]) {
    assert.equal(classifyInbound(type), "silent", type);
  }
  for (const odd of [undefined, null, 5, {}]) assert.equal(classifyInbound(odd), "silent");
});

test("a file is only answered when the bot would answer a text from that contact", () => {
  assert.equal(mediaGate({ isTeam: false, botEnabled: true, optedOut: false }), "proceed");
});

test("a person of the business who sends a file is never answered nor flagged", () => {
  assert.equal(mediaGate({ isTeam: true, botEnabled: true, optedOut: false }), "ignore");
});

test("a chat where the bot is off (manual pause, someone answering, a hand-off) is not interrupted", () => {
  assert.equal(mediaGate({ isTeam: false, botEnabled: false, optedOut: false }), "ignore");
});

test("a contact who asked to stop the messages is not answered nor flagged", () => {
  assert.equal(mediaGate({ isTeam: false, botEnabled: true, optedOut: true }), "ignore");
});

test("any one of the three reasons is enough to stay out", () => {
  for (const isTeam of [false, true]) {
    for (const botEnabled of [false, true]) {
      for (const optedOut of [false, true]) {
        const expected = !isTeam && botEnabled && !optedOut ? "proceed" : "ignore";
        assert.equal(mediaGate({ isTeam, botEnabled, optedOut }), expected, `${isTeam}/${botEnabled}/${optedOut}`);
      }
    }
  }
});

test("the first file gets an answer, and so does one that arrives after another reason opened", () => {
  const now = new Date("2026-11-24T15:00:00Z");
  assert.equal(shouldReplyToMedia({ helpReason: null, helpRequestedAt: null, hasRecentReply: false }, now), true);
  assert.equal(shouldReplyToMedia({ helpReason: "person_requested", helpRequestedAt: new Date("2026-11-24T14:59:00Z"), hasRecentReply: false }, now), true);
});

test("five files in a row get one answer: a recent media request or a recent identical reply silences the rest", () => {
  const now = new Date("2026-11-24T15:00:00Z");
  const justNow = new Date(now.getTime() - 60_000);
  assert.equal(shouldReplyToMedia({ helpReason: "unsupported_media", helpRequestedAt: justNow, hasRecentReply: false }, now), false);
  assert.equal(shouldReplyToMedia({ helpReason: null, helpRequestedAt: null, hasRecentReply: true }, now), false);
});

test("after the cooldown a new file gets an answer again", () => {
  const now = new Date("2026-11-24T15:00:00Z");
  const old = new Date(now.getTime() - (MEDIA_REPLY_COOLDOWN_MINUTES + 1) * 60_000);
  assert.equal(MEDIA_REPLY_COOLDOWN_MINUTES, 10);
  assert.equal(shouldReplyToMedia({ helpReason: "unsupported_media", helpRequestedAt: old, hasRecentReply: false }, now), true);
});

test("the answer is in the business language, names the business and asks to write it", () => {
  const es = mediaReplyText("es", "Mi Negocio");
  const en = mediaReplyText("en", "Mi Negocio");
  assert.match(es, /Mi Negocio/);
  assert.match(es, /escrib/i);
  assert.match(en, /Mi Negocio/);
  assert.match(en, /write/i);
  assert.notEqual(es, en);
});

test("the answer names no provider and no one kind of business", () => {
  for (const language of ["es", "en"]) {
    const text = mediaReplyText(language, "X");
    assert.doesNotMatch(text, /claude|anthropic|openai|gpt|openrouter|evolution|n8n|baileys/i);
    assert.doesNotMatch(text, /consultorio|paciente|patient|cl[ií]nica|clinic|doctor/i);
  }
});

test("#182: for a business that keeps files, the answer adds the 30-day line and its privacy link", () => {
  const base = mediaReplyText("es", "Clínica Sol");
  const stored = mediaReplyText("es", "Clínica Sol", { storesFiles: true, privacyUrl: "https://sol.example.com/privacidad" });
  assert.ok(stored.startsWith(base));
  assert.match(stored, /pueden guardarse hasta 30 días/);
  assert.match(stored, /https:\/\/sol\.example\.com\/privacidad/);
  assert.equal(mediaReplyText("es", "Clínica Sol", { storesFiles: false, privacyUrl: "https://x" }), base);
  const english = mediaReplyText("en", "Sun Clinic", { storesFiles: true, privacyUrl: "https://sun.example.com/privacidad" });
  assert.match(english, /may be kept for up to 30 days/);
  assert.doesNotMatch(stored, /guardan|se guardarán/, "it never promises a file is kept");
});
