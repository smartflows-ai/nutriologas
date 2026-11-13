// src/lib/short-links.ts
// Short links on the tenant's own subdomain, so the messages to customers carry a short address instead of a long one:
//   <tenant>.newaigent.com/ubicacion        -> the business's directions (Google Maps)
//   <tenant>.newaigent.com/online/<code>    -> the video call of ONE appointment, open until 1 hour after it ends.
// Pure functions only. The routes that redirect are in src/app/ubicacion and src/app/online.
import { randomInt } from "node:crypto";
import { tenantPublicUrl } from "./tenant-url";

export const SHORT_CODE_RE = /^[0-9A-Za-z]{8}$/;
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const GRACE_MS = 60 * 60 * 1000; // the link stays open one hour after the visit ends (late joiners, slow clocks)

/** A new code per appointment: 8 characters from a 62-character alphabet, drawn with a cryptographic generator. */
export function newMeetShortCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const SECURE_LINK_RE = /^https:\/\//;

/** Whether the video call link of a visit can be opened now. */
export function meetLinkState(
  visit: { status: string; modality: "IN_PERSON" | "ONLINE" | null | undefined; meetUrl: string | null | undefined; appointmentDate: Date; durationMinutes: number },
  now: Date,
): { open: boolean } {
  const live = visit.status === "PENDING" || visit.status === "CONFIRMED";
  const online = visit.modality === "ONLINE";
  const secure = Boolean(visit.meetUrl && SECURE_LINK_RE.test(visit.meetUrl.trim()));
  const endsAt = visit.appointmentDate.getTime() + visit.durationMinutes * 60 * 1000;
  return { open: live && online && secure && now.getTime() <= endsAt + GRACE_MS };
}

/** What the customer receives: the short link when the visit has a code, the real secure link otherwise, "" if none. */
export function customerMeetUrl(
  visit: { meetUrl: string | null | undefined; meetShortCode: string | null | undefined },
  tenant: { slug: string; customDomain?: string | null },
): string {
  const real = visit.meetUrl?.trim() ?? "";
  if (!SECURE_LINK_RE.test(real)) return "";
  if (visit.meetShortCode && SHORT_CODE_RE.test(visit.meetShortCode)) {
    return tenantPublicUrl(tenant, `/online/${visit.meetShortCode}`);
  }
  return real;
}

/** The address customers get for the business's directions. */
export function locationShortUrl(tenant: { slug: string; customDomain?: string | null }): string {
  return tenantPublicUrl(tenant, "/ubicacion");
}
