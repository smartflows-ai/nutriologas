// src/lib/wa-message-content.ts
// The line a chat stores for a WhatsApp message (whatsapp/sync). Text keeps its text; media gets a marker. Only the
// presence of the media key matters, never the file: the workflow may send just the key, without the base64 (#139).
// Pure, no I/O.

interface WaMessage {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; [key: string]: unknown };
  reactionMessage?: { text?: string };
  [key: string]: unknown;
}

export function messageContentOf(message: WaMessage | null | undefined): string {
  if (message?.conversation) return message.conversation;
  if (message?.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message?.imageMessage?.caption) return message.imageMessage.caption;
  if (message?.imageMessage) return "[Imagen]";
  if (message?.audioMessage) return "[Audio]";
  if (message?.videoMessage) return "[Video]";
  if (message?.documentMessage || message?.documentWithCaptionMessage) return "[Documento]";
  if (message?.reactionMessage) {
    const emoji = message.reactionMessage.text;
    return emoji ? `Reacción ${emoji}` : "Reacción eliminada";
  }
  if (message?.stickerMessage) return "[Sticker]";
  if (message?.locationMessage) return "[Ubicación]";
  if (message?.contactMessage) return "[Contacto]";
  return "[Mensaje Multimedia]";
}
