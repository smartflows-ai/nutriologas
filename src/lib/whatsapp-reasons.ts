// src/lib/whatsapp-reasons.ts
// The failure reasons of a WhatsApp send that are safe to show or store as written: none names a provider or
// carries a raw response body (white-label rule). Anything else is turned into a generic text by
// `safeFailureReason` (src/lib/reminder-state.ts). The technical detail only goes to the server log.

export const WA_NOT_CONNECTED = "WhatsApp no está conectado para este negocio";
export const WA_INVALID_NUMBER = "Número de teléfono inválido";
export const WA_NOT_AVAILABLE = "WhatsApp no está disponible en este momento";

export const CUSTOMER_SAFE_REASONS: readonly string[] = [WA_NOT_CONNECTED, WA_INVALID_NUMBER, WA_NOT_AVAILABLE];
