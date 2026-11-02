// src/lib/calendar-account.ts
// Which account an external calendar is linked to. Read from the provider on demand: the connection record
// does not store the email, and the provider's own answer is the account events are really written to.

import { AppProvider } from "@prisma/client";
import { getAppToken } from "@/lib/connected-apps";

const CALENDAR_PROVIDERS: AppProvider[] = ["GOOGLE", "MICROSOFT"];
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GRAPH_CALENDAR_URL = "https://graph.microsoft.com/v1.0/me/calendar?$select=name,owner";
const REQUEST_TIMEOUT_MS = 8000;

export type CalendarProvider = "GOOGLE" | "MICROSOFT";

export interface CalendarAccount {
  provider: CalendarProvider;
  email: string | null;
}

function asEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Email of the Google account from the `userinfo` reply. */
export function emailFromGoogleUserInfo(info: unknown): string | null {
  if (!info || typeof info !== "object") return null;
  return asEmail((info as { email?: unknown }).email);
}

/** Email of the calendar owner from the Microsoft Graph `/me/calendar` reply. */
export function emailFromGraphCalendar(calendar: unknown): string | null {
  if (!calendar || typeof calendar !== "object") return null;
  const owner = (calendar as { owner?: { address?: unknown } }).owner;
  return asEmail(owner?.address);
}

async function fetchJson(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function emailFor(tenantId: string, provider: CalendarProvider): Promise<string | null> {
  const accessToken = await getAppToken(tenantId, provider);
  if (!accessToken) return null;
  try {
    if (provider === "GOOGLE") return emailFromGoogleUserInfo(await fetchJson(GOOGLE_USERINFO_URL, accessToken));
    return emailFromGraphCalendar(await fetchJson(GRAPH_CALENDAR_URL, accessToken));
  } catch (error) {
    console.error(`[calendar-account] Could not read the ${provider} account:`, error);
    return null;
  }
}

/**
 * The linked calendar of a business: its provider and the account email.
 * Returns null when no calendar is connected; `email` is null when the provider could not be read.
 */
export async function getCalendarAccount(
  tenantId: string,
  connected: AppProvider | null,
): Promise<CalendarAccount | null> {
  if (!connected || !CALENDAR_PROVIDERS.includes(connected)) return null;
  const provider = connected as CalendarProvider;
  return { provider, email: await emailFor(tenantId, provider) };
}
