// src/lib/time-zone-choice.ts
// Which time zone a business keeps when it saves its profile (ticket #111). Pure.
//   - A new address is asked to Google, unless the zone was chosen by hand before and the owner is not changing it.
//   - The owner sending a zone different from the saved one wins. When it is the zone Google gives for the new
//     address (the screen proposed it when the address was picked), it stays "google"; otherwise it is "manual" and
//     sticks: a later address no longer replaces it.
//   - A failed lookup never changes the zone.
// The form always sends the zone it shows, so sending the saved value is not a choice.

export type TimeZoneSource = "default" | "google" | "manual";

export interface TimeZoneState {
  timeZone: string;
  source: TimeZoneSource;
}

export interface TimeZoneSaveInput {
  current: TimeZoneState;
  /** The zone in the saved form (already validated); undefined when the form did not send one. */
  requested: string | undefined;
  /** True when this save stores new address coordinates. */
  addressChanged: boolean;
}

/** What the owner reads after saving: detected by the address, could not detect, or nothing to detect. */
export type TimeZoneDetection = "detected" | "failed" | "skipped";

const ownerChose = (input: TimeZoneSaveInput) =>
  input.requested !== undefined && input.requested !== input.current.timeZone;

/** True when this save should ask Google for the zone of the new address. */
export function shouldDetectTimeZone(input: TimeZoneSaveInput): boolean {
  return input.addressChanged && (input.current.source !== "manual" || ownerChose(input));
}

export function chooseTimeZone(
  input: TimeZoneSaveInput & { detected: string | null },
): TimeZoneState & { detection: TimeZoneDetection } {
  const detected = shouldDetectTimeZone(input) ? input.detected : null;
  if (ownerChose(input)) {
    const requested = input.requested as string;
    return detected === requested
      ? { timeZone: requested, source: "google", detection: "detected" }
      : { timeZone: requested, source: "manual", detection: "skipped" };
  }
  if (!shouldDetectTimeZone(input)) return { ...input.current, detection: "skipped" };
  if (!detected) return { ...input.current, detection: "failed" };
  return { timeZone: detected, source: "google", detection: "detected" };
}

/** A stored source, read safely ("default" for anything unknown). */
export function timeZoneSourceOf(value: string | null | undefined): TimeZoneSource {
  return value === "google" || value === "manual" ? value : "default";
}
