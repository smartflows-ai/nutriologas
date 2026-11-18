// tests/clinic-time.test.ts
// Ticket #111: wall-clock times of a business are read and written in that business's own time zone, never in UTC
// or in the server's or browser's zone. One module converts (src/lib/clinic-time.ts) and always receives the zone.
// Run with: npx tsx --test tests/clinic-time.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TIME_ZONE,
  clinicDateKeyOf,
  clinicDateTime,
  clinicIsoOf,
  clinicOffsetOf,
  clinicTimeLabel,
  clinicTimeOf,
  clinicWeekdayOf,
  isRealClinicTime,
  isValidTimeZone,
} from "../src/lib/clinic-time";

const CDMX = "America/Mexico_City";
const CANCUN = "America/Cancun";
const HERMOSILLO = "America/Hermosillo";
const TIJUANA = "America/Tijuana";
const at = (iso: string) => new Date(iso);

test("the default zone is Mexico City, as every business had before the setting existed", () => {
  assert.equal(DEFAULT_TIME_ZONE, CDMX);
});

test("an evening visit keeps its own day and time (01:30 UTC of the next day is 19:30 in Mexico City)", () => {
  const visit = at("2026-11-18T01:30:00Z");
  assert.match(clinicTimeLabel(visit, CDMX), /^07:30\s?p\.\s?m\.$/);
  assert.equal(clinicWeekdayOf(visit, CDMX), "martes");
  assert.equal(clinicDateKeyOf(visit, CDMX), "2026-11-17");
  assert.equal(clinicTimeOf(visit, CDMX), "19:30");
});

test("one minute before midnight is still the same day, midnight belongs to the new day", () => {
  assert.equal(clinicWeekdayOf(at("2026-11-18T05:59:00Z"), CDMX), "martes");
  assert.match(clinicTimeLabel(at("2026-11-18T05:59:00Z"), CDMX), /^11:59\s?p\.\s?m\.$/);
  assert.equal(clinicWeekdayOf(at("2026-11-18T06:00:00Z"), CDMX), "miércoles");
  assert.match(clinicTimeLabel(at("2026-11-18T06:00:00Z"), CDMX), /^12:00\s?a\.\s?m\.$/);
});

test("noon reads as p.m.", () => {
  assert.match(clinicTimeLabel(at("2026-11-21T18:00:00Z"), CDMX), /^12:00\s?p\.\s?m\.$/);
  assert.equal(clinicWeekdayOf(at("2026-11-21T18:00:00Z"), CDMX), "sábado");
});

test("the weekday is lowercase Spanish for every day of the week", () => {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  days.forEach((day, i) => {
    assert.equal(clinicWeekdayOf(new Date(Date.UTC(2026, 10, 15 + i, 16, 0)), CDMX), day);
  });
});

test("the same instant reads differently in each business zone", () => {
  const instant = at("2026-11-18T15:00:00Z");
  assert.equal(clinicTimeOf(instant, CDMX), "09:00");
  assert.equal(clinicTimeOf(instant, CANCUN), "10:00");
  assert.equal(clinicTimeOf(instant, HERMOSILLO), "08:00");
  assert.equal(clinicTimeOf(instant, TIJUANA), "07:00");
});

test("a wall-clock time becomes the right instant in each zone, with that day's offset", () => {
  assert.equal(clinicDateTime("2026-11-17", "19:30", CDMX), "2026-11-17T19:30:00-06:00");
  assert.equal(clinicDateTime("2026-11-18", "10:00", CANCUN), "2026-11-18T10:00:00-05:00");
  assert.equal(clinicDateTime("2026-11-18", "10:00", HERMOSILLO), "2026-11-18T10:00:00-07:00");
  // Tijuana follows daylight saving time: winter -08:00, summer -07:00.
  assert.equal(clinicDateTime("2026-11-18", "09:00", TIJUANA), "2026-11-18T09:00:00-08:00");
  assert.equal(clinicDateTime("2026-07-15", "09:00", TIJUANA), "2026-07-15T09:00:00-07:00");
});

test("a wall-clock time and back gives the same date and time (round trip)", () => {
  for (const zone of [CDMX, CANCUN, HERMOSILLO, TIJUANA]) {
    for (const [date, time] of [["2026-11-17", "00:00"], ["2026-11-17", "23:59"], ["2026-07-01", "12:30"]]) {
      const instant = new Date(clinicDateTime(date, time, zone));
      assert.equal(clinicDateKeyOf(instant, zone), date, `${zone} ${date} ${time}`);
      assert.equal(clinicTimeOf(instant, zone), time, `${zone} ${date} ${time}`);
    }
  }
});

test("the offset of a zone is read for the given day", () => {
  assert.equal(clinicOffsetOf(at("2026-11-18T12:00:00Z"), CDMX), "-06:00");
  assert.equal(clinicOffsetOf(at("2026-11-18T12:00:00Z"), CANCUN), "-05:00");
  assert.equal(clinicOffsetOf(at("2026-07-15T12:00:00Z"), TIJUANA), "-07:00");
  assert.equal(clinicOffsetOf(at("2026-11-18T12:00:00Z"), "Europe/Madrid"), "+01:00");
});

test("the hour skipped when the clock moves forward does not exist; the repeated hour uses its first instant", () => {
  // Tijuana, 8 Mar 2026: 02:00 jumps to 03:00.
  assert.equal(isRealClinicTime("2026-03-08", "02:30", TIJUANA), false);
  assert.equal(isRealClinicTime("2026-03-08", "03:30", TIJUANA), true);
  assert.equal(isRealClinicTime("2026-11-17", "19:30", CDMX), true);
  // Tijuana, 1 Nov 2026: 01:00-02:00 happens twice; the first one is still daylight time (-07:00).
  assert.equal(clinicDateTime("2026-11-01", "01:30", TIJUANA), "2026-11-01T01:30:00-07:00");
});

test("only real IANA zone names are valid", () => {
  for (const zone of [CDMX, CANCUN, TIJUANA, "America/New_York", "Europe/Madrid", "America/Argentina/Buenos_Aires", "UTC"]) {
    assert.equal(isValidTimeZone(zone), true, zone);
  }
  for (const zone of ["", "-06:00", "+01:00", "GMT-6", "Mexico City", "America/Nowhere", null, undefined, 42]) {
    assert.equal(isValidTimeZone(zone), false, String(zone));
  }
});

test("an instant is written on the business clock with that moment's offset, also in the repeated hour", () => {
  assert.equal(clinicIsoOf(at("2026-11-18T01:30:00Z"), CDMX), "2026-11-17T19:30:00-06:00");
  // Tijuana, 1 Nov 2026: 01:30 happens at 08:30Z (daylight time) and again at 09:30Z (standard time).
  assert.equal(clinicIsoOf(at("2026-11-01T08:30:00Z"), TIJUANA), "2026-11-01T01:30:00-07:00");
  assert.equal(clinicIsoOf(at("2026-11-01T09:30:00Z"), TIJUANA), "2026-11-01T01:30:00-08:00");
});
