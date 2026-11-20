// src/lib/whatsapp-permission.ts
// Holes 4 and 5: what the agenda shows about a patient's WhatsApp permission. Pure, no I/O.
// Tests: tests/whatsapp-permission.test.ts.
//
// OPTED_OUT: the patient asked not to receive messages (overrides everything).
// YES: consent recorded for this visit (booked on WhatsApp, web checkbox or staff checkbox).
// NONE: no consent recorded for this visit. In SHADOW mode reminders still go out; the badge tells the staff to call.

export type WhatsAppPermission = "YES" | "NONE" | "OPTED_OUT";

/** The digits of a WhatsApp JID, e.g. "5215512345678@s.whatsapp.net" -> "5215512345678". */
export function digitsOfJid(jid: string): string {
  // The device suffix (":12") is not part of the number.
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}

export function whatsappPermissionOf(
  visit: { whatsappConsentAt?: Date | string | null },
  phoneDigits: string | null | undefined,
  optedOutDigits: ReadonlySet<string>,
): WhatsAppPermission {
  if (phoneDigits && optedOutDigits.has(phoneDigits)) return "OPTED_OUT";
  return visit.whatsappConsentAt ? "YES" : "NONE";
}

/** The badge is for visits still to happen (the agenda shows the rest without it). */
export function needsPermissionBadge(
  permission: WhatsAppPermission,
  visit: { status: string; customerPhone?: string | null; deleted?: boolean },
): boolean {
  if (visit.deleted) return false;
  if (!visit.customerPhone) return false;
  if (visit.status !== "PENDING" && visit.status !== "CONFIRMED") return false;
  return permission !== "YES";
}
