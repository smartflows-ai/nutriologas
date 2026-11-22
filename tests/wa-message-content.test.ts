// tests/wa-message-content.test.ts
// Ticket #139: the line a chat stores for each kind of WhatsApp message (whatsapp/sync). The workflow sends only the
// key of the media type, without the file, so the markers must not depend on the file content.
// Run with: npx tsx --test tests/wa-message-content.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { messageContentOf } from "../src/lib/wa-message-content";

test("text messages keep their text", () => {
  assert.equal(messageContentOf({ conversation: "hola" }), "hola");
  assert.equal(messageContentOf({ extendedTextMessage: { text: "con enlace" } }), "con enlace");
});

test("an image without a caption is stored as [Imagen], with a caption as the caption", () => {
  assert.equal(messageContentOf({ imageMessage: {} }), "[Imagen]");
  assert.equal(messageContentOf({ imageMessage: { caption: "mi estudio" } }), "mi estudio");
});

test("audio, video and document keep their markers", () => {
  assert.equal(messageContentOf({ audioMessage: {} }), "[Audio]");
  assert.equal(messageContentOf({ videoMessage: {} }), "[Video]");
  assert.equal(messageContentOf({ documentMessage: {} }), "[Documento]");
});

test("a payload with only the type key, no file, gives the same marker as one with the file", () => {
  assert.equal(messageContentOf({ audioMessage: {} }), messageContentOf({ audioMessage: { url: "x", base64: "AAAA" } }));
  assert.equal(messageContentOf({ imageMessage: {} }), messageContentOf({ imageMessage: { base64: "AAAA" } }));
});

test("the other kinds keep what they had", () => {
  assert.equal(messageContentOf({ stickerMessage: {} }), "[Sticker]");
  assert.equal(messageContentOf({ locationMessage: {} }), "[Ubicación]");
  assert.equal(messageContentOf({ contactMessage: {} }), "[Contacto]");
  assert.equal(messageContentOf({ reactionMessage: { text: "👍" } }), "Reacción 👍");
  assert.equal(messageContentOf({ reactionMessage: { text: "" } }), "Reacción eliminada");
  assert.equal(messageContentOf({ somethingNew: {} }), "[Mensaje Multimedia]");
  assert.equal(messageContentOf(undefined), "[Mensaje Multimedia]");
});
