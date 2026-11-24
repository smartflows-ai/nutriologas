// src/lib/whatsapp-phone.ts
// The number of the business's own WhatsApp line, as shown in the panel ("Conectado: <number>"). Pure, no I/O.
// Tests: tests/whatsapp-phone.test.ts.

/** Digits of a phone JID ("5215512345678:12@s.whatsapp.net" -> "5215512345678"). An @lid or a short value: null. */
export function phoneFromJid(jid: unknown): string | null {
  if (typeof jid !== "string" || !jid.trim()) return null;
  if (jid.endsWith("@lid")) return null;
  const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export interface LineRow {
  waStatus: string | null;
  waPhoneNumber: string | null;
  waInstanceId: string | null;
}

/**
 * A connected line with no saved number. The number used to be saved only while the /admin/apps modal polled the
 * QR, and Evolution fills it a moment after the connection opens, so it could stay empty for good (QA 2026-11-20).
 */
export function needsPhoneBackfill(app: LineRow): boolean {
  return app.waStatus === "connected" && !app.waPhoneNumber && Boolean(app.waInstanceId);
}

/**
 * Reads the owner number right after the connection opens. Evolution fills it a moment later, so the read is repeated
 * (with a pause between reads) before giving up. Injected read and pause keep it testable.
 */
export async function readOwnerPhone(
  read: () => Promise<string | null>,
  opts: { tries: number; wait: () => Promise<void> },
): Promise<string | null> {
  for (let i = 0; i < opts.tries; i += 1) {
    const phone = await read();
    if (phone) return phone;
    if (i < opts.tries - 1) await opts.wait();
  }
  return null;
}
