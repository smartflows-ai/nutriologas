// src/lib/wa-optout.ts
// Detects a clear "stop messaging me" request in an inbound WhatsApp message.
// Pure, no I/O. Tests: tests/wa-optout.test.ts.
//
// Ban-prevention bias: a false negative (we keep messaging after the customer said stop) is the dangerous
// case — it leads to reports and blocks, the top cause of a number being banned. So detection is generous,
// EXCEPT it must never fire on "cancelar mi cita" and similar, which are appointment actions the bot handles,
// not a request to stop all messages.

/** lowercase, strip accents, keep letters/digits/spaces, collapse spaces. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Bare one-word commands (the whole message, punctuation aside).
const BARE_COMMANDS = new Set(["baja", "stop", "unsubscribe", "unsuscribe", "desuscribir"]);

// Unambiguous "stop messaging me" phrases. None mentions "cita", so they stand on their own.
const STOP_PHRASES: RegExp[] = [
  // "no me escriban / escribas / escriba": a request. The past ("no me escribieron el link") is a complaint, not a stop.
  /\bno me escrib(an|as|a|ir)\b/,
  // "no me manden" alone or followed by more/nothing/messages. "No me manden la ubicacion" is about one thing, not a stop.
  /\bno me (manden|mande|mandes|envien|envie|envies|mandar|enviar)(?: (mas|nada|ningun\w*|mensajes?|whatsapps?|whats|promociones|publicidad)\b|$)/,
  /\bdej[ae](r|n|s|me|nme|los)? de (escribir|enviar|mandar|molestar|contactar)/,
  /\bno (quiero|deseo)(?: recibir)?(?: mas)? mensaj/,
  /\bno me (contacten|contacte|contactes|contactar)/,
  /\b(eliminen|elimina|eliminar|borren|borra|borrar|quiten|quita|quitar) mi numero/,
];

// "de baja" opt-out, only in a message/subscription sense, never when it is about a cita.
const DE_BAJA = /\b(darme|dar|de) baja\b/;

export function isOptOut(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;

  if (BARE_COMMANDS.has(t)) return true;

  if (STOP_PHRASES.some((re) => re.test(t))) return true;

  // "quiero darme de baja", "denme de baja de los mensajes" — but not "dar de baja la cita".
  if (DE_BAJA.test(t) && !/\bcita\b/.test(t)) return true;

  return false;
}
