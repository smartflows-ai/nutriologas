// tests/wa-message-content.test.ts
// Ticket #139: the line a chat stores for each kind of WhatsApp message (whatsapp/sync). The workflow sends only the
// key of the media type, without the file, so the markers must not depend on the file content.
// Run with: npx tsx --test tests/wa-message-content.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { isMediaMarker, messageContentOf } from "../src/lib/wa-message-content";

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
  assert.equal(messageContentOf({ documentWithCaptionMessage: {} }), "[Documento]");
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

// Ticket #182: shapes read in the WhatsApp connection 2.3.7 and seen in the workflow runs (arch, 2026-11-25).
test("a document with a caption keeps its caption, in both shapes", () => {
  assert.equal(messageContentOf({ documentMessage: { caption: "resultados" } }), "resultados");
  assert.equal(
    messageContentOf({ documentWithCaptionMessage: { message: { documentMessage: { caption: "resultados" } } } }),
    "resultados",
  );
  assert.equal(messageContentOf({ documentWithCaptionMessage: { message: { documentMessage: {} } } }), "[Documento]");
});

test("a video with a caption keeps its caption", () => {
  assert.equal(messageContentOf({ videoMessage: { caption: "así camina" } }), "así camina");
});

test("a view-once message is recognized by any of its three outer keys and labeled by the type inside", () => {
  for (const outer of ["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension"]) {
    assert.equal(messageContentOf({ [outer]: { message: { imageMessage: {} } } }), "[Foto de una sola vez]", outer);
    assert.equal(messageContentOf({ [outer]: { message: { videoMessage: {} } } }), "[Video de una sola vez]", outer);
    assert.equal(messageContentOf({ [outer]: { message: { audioMessage: {} } } }), "[Audio de una sola vez]", outer);
  }
});

test("a view-once flag on the media itself is also view-once, and its caption is not shown", () => {
  assert.equal(messageContentOf({ imageMessage: { viewOnce: true, caption: "secreto" } }), "[Foto de una sola vez]");
  assert.equal(messageContentOf({ viewOnceMessageV2: { message: { imageMessage: { caption: "secreto" } } } }), "[Foto de una sola vez]");
});

test("a round video note (ptvMessage) is a video", () => {
  assert.equal(messageContentOf({ ptvMessage: {} }), "[Video]");
});

test("the empty shape the workflow sends still gives the marker", () => {
  assert.equal(messageContentOf({ imageMessage: {} }), "[Imagen]");
  assert.equal(messageContentOf({ stickerMessage: {} }), "[Sticker]");
});

test("an empty view-once wrapper (no .message) is still view once: photo marker", () => {
  for (const outer of ["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension"]) {
    assert.equal(messageContentOf({ [outer]: {} }), "[Foto de una sola vez]", outer);
  }
});

test("every marker a file message can get is in the marker list the screen hides next to the file (#182)", () => {
  const shapes = [
    { imageMessage: {} }, { audioMessage: {} }, { videoMessage: {} }, { ptvMessage: {} }, { documentMessage: {} },
    { documentWithCaptionMessage: {} }, { stickerMessage: {} }, { somethingNew: {} },
    { viewOnceMessageV2: { message: { imageMessage: {} } } }, { viewOnceMessage: { message: { videoMessage: {} } } },
    { viewOnceMessageV2Extension: { message: { audioMessage: {} } } }, { viewOnceMessageV2: {} },
  ];
  for (const shape of shapes) assert.equal(isMediaMarker(messageContentOf(shape)), true, JSON.stringify(shape));
  assert.equal(isMediaMarker("mi estudio"), false);
  assert.equal(isMediaMarker("[Ubicación]"), false, "location is not a file");
});
