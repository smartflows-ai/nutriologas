// src/lib/confirmation-words.ts
// Recognizes a clear "sí" in a customer's reply. Pure, no I/O.
// Lives outside the route file: Next.js route files may only export route handlers and config.

const CONFIRM_WORDS = /^(si|confirmo|confirmada|confirmado|ok|okay|de acuerdo|claro|perfecto|va|sale|dale|sip|simon|listo)\b/;
const NOT_A_CONFIRMATION = /\b(no|cancel|cambi|mover|reagend|otra|otro|despues|luego|pero)/;
const MAX_WORDS = 5;

/** A short reply that clearly says yes and nothing about changing or cancelling. */
export function isClearConfirmation(text: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.split(" ").length > MAX_WORDS) return false;
  if (NOT_A_CONFIRMATION.test(normalized)) return false;
  return CONFIRM_WORDS.test(normalized);
}
