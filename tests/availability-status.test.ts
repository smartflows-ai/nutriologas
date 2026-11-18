// Each time the agent asks about gets one status, from its facts; the clock is normalized; the message says why.
import test from "node:test";
import assert from "node:assert/strict";
import { classifyRequestedTime, normalizeClock, slotQuery, type RequestedTimeFacts } from "../src/lib/slot-query";
import { availabilityMessage, type AvailabilityContext } from "../src/lib/availability-message";
import { insideBusinessHours, type BusinessHours } from "../src/lib/business-hours";

const OPEN: RequestedTimeFacts = { inside: true, past: false, fits: true, free: true };
const NO_CTX: AvailabilityContext = { pastDate: false, closedDay: false, serviceTooLong: false, durationMinutes: 30 };

test("an open hour that is free is free, even when it is not on the service's own grid (09:15)", () => {
  assert.equal(classifyRequestedTime(OPEN), "free");
});

test("an open hour that is taken by a visit or an event is taken", () => {
  assert.equal(classifyRequestedTime({ ...OPEN, free: false }), "taken");
});

test("an hour the business does not open at is closed, whatever else is true", () => {
  assert.equal(classifyRequestedTime({ ...OPEN, inside: false, fits: false }), "closed");
});

test("an open hour where the service does not finish before closing is no_fit, not closed", () => {
  assert.equal(classifyRequestedTime({ ...OPEN, fits: false, free: false }), "no_fit");
});

test("an hour that already passed is past, before anything else", () => {
  assert.equal(classifyRequestedTime({ inside: false, past: true, fits: false, free: false }), "past");
  assert.equal(classifyRequestedTime({ ...OPEN, past: true }), "past");
});

test("the clock accepts 9:00 and 09:00, and rejects seconds, am/pm, 24:00 and 25:00", () => {
  assert.equal(normalizeClock("9:00"), "09:00");
  assert.equal(normalizeClock("09:00"), "09:00");
  assert.equal(normalizeClock("17:30"), "17:30");
  assert.equal(normalizeClock("10:00:00"), null);
  assert.equal(normalizeClock("3pm"), null);
  assert.equal(normalizeClock("24:00"), null);
  assert.equal(normalizeClock("25:00"), null);
  assert.equal(normalizeClock("10:60"), null);
});

test("insideBusinessHours is true from a block's start up to its end, not at the end", () => {
  const hours: BusinessHours = {
    sunday: [], monday: [{ start: "09:00", end: "13:00" }, { start: "15:30", end: "18:00" }], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [],
  };
  assert.equal(insideBusinessHours(hours, "2026-11-23", "09:15"), true);
  assert.equal(insideBusinessHours(hours, "2026-11-23", "13:00"), false, "the lunch break");
  assert.equal(insideBusinessHours(hours, "2026-11-23", "15:30"), true);
  assert.equal(insideBusinessHours(hours, "2026-11-23", "18:00"), false, "closing time");
  assert.equal(insideBusinessHours(hours, "2026-11-22", "10:00"), false, "a closed day");
});

test("the message names the reason for each status and lists only the times offered", () => {
  const grid = ["09:00", "09:30", "10:00"];
  const day = "2026-11-23";
  const free = slotQuery({ grid, free: ["09:00", "09:30"], time: "09:15", status: "free" });
  assert.match(availabilityMessage(day, free, NO_CTX), /está libre/);

  const closed = slotQuery({ grid, free: ["09:00"], time: "13:00", status: "closed" });
  assert.match(availabilityMessage(day, closed, NO_CTX), /no atiende a las 13:00 el 2026-11-23\. Ofrece solo estas: 09:00\./);

  const past = slotQuery({ grid, free: ["18:00"], time: "09:00", status: "past" });
  assert.match(availabilityMessage(day, past, NO_CTX), /ya pasó/);

  const noFit = slotQuery({ grid, free: ["09:00"], time: "16:30", status: "no_fit" });
  assert.match(availabilityMessage(day, noFit, { ...NO_CTX, durationMinutes: 60 }), /abierto a las 16:30.*\(60 min\) no termina antes del cierre/);

  const taken = slotQuery({ grid, free: ["09:00"], time: "10:00", status: "taken" });
  assert.match(availabilityMessage(day, taken, NO_CTX), /está ocupada/);
  assert.doesNotMatch(availabilityMessage(day, closed, NO_CTX), /no está disponible/, "never the vague sentence");
});

test("a past date, a closed day and a service longer than any block each get their own sentence", () => {
  const empty = slotQuery({ grid: [], free: [], time: "10:00", status: "closed" });
  assert.equal(availabilityMessage("2026-11-01", empty, { ...NO_CTX, pastDate: true }), "La fecha 2026-11-01 ya pasó. No hay horarios que ofrecer.");
  assert.equal(availabilityMessage("2026-11-22", empty, { ...NO_CTX, closedDay: true }), "El negocio no atiende el 2026-11-22. Ofrece otro día.");
  assert.match(availabilityMessage("2026-11-23", empty, { ...NO_CTX, serviceTooLong: true, durationMinutes: 120 }), /dura 120 min y ningún horario/);
});
