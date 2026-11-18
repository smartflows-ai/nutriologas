// src/lib/time-zone-lookup.ts
// Detects a business's time zone from its address coordinates with Google's Time Zone API (ticket #111).
// Server only: it uses GOOGLE_MAPS_API_KEY, which must allow "Time Zone API" in Google Cloud.
// Any failure returns null: the caller keeps the zone it had and the address is still saved.
// The network is injected (TimeZoneLookupDeps) so the rules are tested without calling Google.
import { isValidTimeZone } from "./clinic-time";

const ENDPOINT = "https://maps.googleapis.com/maps/api/timezone/json";
const TIMEOUT_MS = 5_000;

export interface TimeZoneLookupDeps {
  apiKey: string | undefined;
  now: () => Date;
  /** Only short, safe text: never the key or Google's raw answer. */
  log: (message: string) => void;
  fetchJson: (url: string) => Promise<{ status: number; body: unknown }>;
}

const validCoordinates = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** IANA zone of a place ("America/Cancun"), or null when it cannot be known right now. */
export async function lookupTimeZone(lat: number, lng: number, deps: TimeZoneLookupDeps): Promise<string | null> {
  if (!deps.apiKey || !validCoordinates(lat, lng)) return null;
  const url = new URL(ENDPOINT);
  url.searchParams.set("location", `${lat},${lng}`);
  // The zone's rules on this date; the zone name itself does not depend on it.
  url.searchParams.set("timestamp", String(Math.floor(deps.now().getTime() / 1000)));
  url.searchParams.set("key", deps.apiKey);

  try {
    const { status, body } = await deps.fetchJson(url.toString());
    const answer = (body ?? {}) as { status?: unknown; timeZoneId?: unknown };
    if (status !== 200 || answer.status !== "OK") {
      deps.log(`[time-zone-lookup] not detected: http=${status} status=${String(answer.status ?? "none")}`);
      return null;
    }
    if (!isValidTimeZone(answer.timeZoneId)) {
      deps.log("[time-zone-lookup] not detected: answer is not an IANA zone");
      return null;
    }
    return answer.timeZoneId;
  } catch {
    deps.log("[time-zone-lookup] not detected: request failed");
    return null;
  }
}

/** Real I/O: Google over fetch with a 5 second limit. */
export const realTimeZoneLookupDeps: TimeZoneLookupDeps = {
  apiKey: process.env.GOOGLE_MAPS_API_KEY,
  now: () => new Date(),
  log: (message) => console.warn(message),
  fetchJson: async (url) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    return { status: res.status, body: await res.json().catch(() => null) };
  },
};
