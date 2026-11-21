// tests/time-zone-change.test.ts
// Ticket #127: what changing the business time zone does to the visits already booked, and when two zones are the
// same clock. Pure: no database, the clock is passed in.
// Run with: npx tsx --test tests/time-zone-change.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { sameClock, zoneShiftImpact, type ShiftVisitInput } from "../src/lib/time-zone-change";
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from "../src/lib/business-hours";

const NOW = new Date("2026-11-20T18:00:00Z");

// Fridays and Mondays 15:00 to 20:00, like the business of the QA (closed the rest of the week).
const AFTERNOONS: BusinessHours = {
  ...DEFAULT_BUSINESS_HOURS,
  monday: [{ start: "15:00", end: "20:00" }],
  friday: [{ start: "15:00", end: "20:00" }],
};

const visit = (id: string, iso: string): ShiftVisitInput => ({
  id,
  appointmentDate: new Date(iso),
  customerName: "Ana Garza",
  productName: "Consulta",
});

test("two zone names with the same hour all year are the same clock", () => {
  assert.equal(sameClock("America/Monterrey", "America/Mexico_City", NOW), true);
  assert.equal(sameClock("America/Cancun", "America/Cancun", NOW), true);
});

test("zones with a different hour today, or only part of the year, are not the same clock", () => {
  assert.equal(sameClock("America/Cancun", "America/Mexico_City", NOW), false);
  assert.equal(sameClock("America/Tijuana", "America/Mexico_City", NOW), false);
  // Chicago matches Mexico City in winter and differs in summer (daylight saving time).
  assert.equal(sameClock("America/Chicago", "America/Mexico_City", NOW), false);
});

test("a visit keeps its instant, so on the new clock it reads one hour earlier (Cancun to Mexico City)", () => {
  // 20:30 UTC is 15:30 in Cancun and 14:30 in Mexico City, on Monday 23-nov.
  const shifted = zoneShiftImpact([visit("a", "2026-11-23T20:30:00Z")], "America/Cancun", "America/Mexico_City", AFTERNOONS);
  assert.deepEqual(shifted, [
    {
      id: "a",
      customerName: "Ana Garza",
      productName: "Consulta",
      fromDate: "2026-11-23",
      fromTime: "15:30",
      toDate: "2026-11-23",
      toTime: "14:30",
      outsideHours: true,
    },
  ]);
});

test("a shifted visit that still falls inside the hours is listed, not flagged", () => {
  const [shifted] = zoneShiftImpact([visit("b", "2026-11-23T21:30:00Z")], "America/Cancun", "America/Mexico_City", AFTERNOONS);
  assert.equal(shifted.toTime, "15:30");
  assert.equal(shifted.outsideHours, false);
});

test("a visit can move to another day on the new clock", () => {
  // 05:30 UTC on 24-nov is 00:30 in Cancun (24-nov) and 23:30 in Mexico City (23-nov).
  const [shifted] = zoneShiftImpact([visit("c", "2026-11-24T05:30:00Z")], "America/Cancun", "America/Mexico_City", AFTERNOONS);
  assert.equal(shifted.fromDate, "2026-11-24");
  assert.equal(shifted.toDate, "2026-11-23");
  assert.equal(shifted.outsideHours, true);
});

test("the same zone, or a zone with the same clock, moves nothing", () => {
  const visits = [visit("a", "2026-11-23T20:30:00Z")];
  assert.deepEqual(zoneShiftImpact(visits, "America/Cancun", "America/Cancun", AFTERNOONS), []);
  assert.deepEqual(zoneShiftImpact(visits, "America/Monterrey", "America/Mexico_City", AFTERNOONS), []);
  assert.deepEqual(zoneShiftImpact([], "America/Cancun", "America/Mexico_City", AFTERNOONS), []);
});
