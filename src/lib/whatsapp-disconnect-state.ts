// src/lib/whatsapp-disconnect-state.ts
// The marks a WhatsApp disconnect leaves in connected_apps.waStatus while it runs (no schema change).
// Used by the server service only; the screen does not resume a disconnect when it is opened again.

export const DISCONNECTING = "disconnecting";
export const DISCONNECT_FAILED = "disconnect_failed";
