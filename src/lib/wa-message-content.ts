// src/lib/wa-message-content.ts
// The line a chat stores for a WhatsApp message (whatsapp/sync). Text keeps its text; media gets a marker. Only the
// presence of the media key matters, never the file: the workflow may send just the key, without the base64 (#139).
// Pure, no I/O.

type WaPart = Record<string, unknown>;

interface WaMessage {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; [key: string]: unknown };
  reactionMessage?: { text?: string };
  [key: string]: unknown;
}

/** Outer keys that only wrap the real message in `.message` (WhatsApp connection 2.3.7, #182). */
const VIEW_ONCE_WRAPPERS = ["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension"] as const;
const PLAIN_WRAPPERS = ["ephemeralMessage", "documentWithCaptionMessage"] as const;
const VIEW_ONCE_FLAGGED = ["imageMessage", "videoMessage", "audioMessage"] as const;
const MAX_WRAP_DEPTH = 4;

export interface UnwrappedWaMessage {
  message: WaPart;
  viewOnce: boolean;
}

function asPart(value: unknown): WaPart | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as WaPart) : null;
}

/**
 * The message inside its wrappers (view once, disappearing, document with caption), and whether a wrapper (even an
 * empty one) or the media itself says "view once". A message with no wrapper, or a wrapper with nothing inside,
 * comes back as it is.
 */
export function unwrapWaMessage(message: unknown): UnwrappedWaMessage {
  let current = asPart(message) ?? {};
  let viewOnce = false;
  for (let depth = 0; depth < MAX_WRAP_DEPTH; depth += 1) {
    // A view-once wrapper is view once even when it comes empty (#182 review): it is never a downloadable file.
    if (VIEW_ONCE_WRAPPERS.some((key) => asPart(current[key]))) viewOnce = true;
    const key = [...VIEW_ONCE_WRAPPERS, ...PLAIN_WRAPPERS].find((name) => asPart(asPart(current[name])?.message));
    if (!key) break;
    current = asPart(asPart(current[key])?.message) ?? {};
  }
  const flagged = VIEW_ONCE_FLAGGED.some((key) => asPart(current[key])?.viewOnce === true);
  return { message: current, viewOnce: viewOnce || flagged };
}

/** Every marker this module stores for a message with a file (the screen hides it next to the file, #182). */
export const MEDIA_MARKERS: readonly string[] = [
  "[Imagen]",
  "[Audio]",
  "[Video]",
  "[Documento]",
  "[Sticker]",
  "[Foto de una sola vez]",
  "[Video de una sola vez]",
  "[Audio de una sola vez]",
  "[Mensaje Multimedia]",
];

export function isMediaMarker(content: string): boolean {
  return MEDIA_MARKERS.includes(content);
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function viewOnceMarker(message: WaPart): string {
  if (message.videoMessage) return "[Video de una sola vez]";
  if (message.audioMessage) return "[Audio de una sola vez]";
  return "[Foto de una sola vez]";
}

function mediaMarker(message: WaPart): string | null {
  if (message.imageMessage) return "[Imagen]";
  if (message.audioMessage) return "[Audio]";
  if (message.videoMessage || message.ptvMessage) return "[Video]";
  if (message.documentMessage || message.documentWithCaptionMessage) return "[Documento]";
  return null;
}

export function messageContentOf(raw: WaMessage | null | undefined): string {
  const { message, viewOnce } = unwrapWaMessage(raw);
  const text = textOf(message.conversation) ?? textOf(asPart(message.extendedTextMessage)?.text);
  if (text) return text;
  // A view-once file never shows its caption: it is meant to be seen once, on the phone.
  if (viewOnce) return viewOnceMarker(message);
  const caption =
    textOf(asPart(message.imageMessage)?.caption) ??
    textOf(asPart(message.videoMessage)?.caption) ??
    textOf(asPart(message.documentMessage)?.caption);
  if (caption) return caption;
  const marker = mediaMarker(message);
  if (marker) return marker;
  const reaction = asPart(message.reactionMessage);
  if (reaction) {
    const emoji = textOf(reaction.text);
    return emoji ? `Reacción ${emoji}` : "Reacción eliminada";
  }
  if (message.stickerMessage) return "[Sticker]";
  if (message.locationMessage) return "[Ubicación]";
  if (message.contactMessage) return "[Contacto]";
  return "[Mensaje Multimedia]";
}
