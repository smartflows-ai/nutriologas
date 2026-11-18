// What the WhatsApp agent asks about a day: one exact time, the first or last free time, or the next free times.
import test from "node:test";
import assert from "node:assert/strict";
import { slotQuery, weekdayNameEs, SLOTS_OFFERED_PER_REPLY } from "../src/lib/slot-query";

// A clinic open 09:00 to 20:00 every 30 minutes (grid); the free times are a subset.
const GRID = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];

test("an exact free time is reported as free, with the nearest other free times", () => {
  const free = ["09:00", "10:00", "10:30", "11:00", "12:00", "18:00"];
  const result = slotQuery({ grid: GRID, free, time: "10:00" });
  assert.deepEqual(result.requested, { time: "10:00", status: "free" });
  assert.deepEqual(result.availableSlots, ["09:00", "10:30", "11:00"]);
  assert.equal(result.hasMore, false);
});

test("an exact taken time is reported as taken, with the three nearest free times", () => {
  const free = ["09:00", "10:30", "11:00", "12:00", "18:00", "18:30"];
  const result = slotQuery({ grid: GRID, free, time: "10:00" });
  assert.deepEqual(result.requested, { time: "10:00", status: "taken" });
  assert.deepEqual(result.availableSlots, ["09:00", "10:30", "11:00"]);
});

test("a time that is not offered that day (outside hours) is reported as outside_hours", () => {
  const free = ["09:00", "18:00"];
  const result = slotQuery({ grid: GRID, free, time: "20:00" });
  assert.deepEqual(result.requested, { time: "20:00", status: "outside_hours" });
  assert.deepEqual(result.availableSlots, ["18:00", "09:00"].sort());
});

test("an 18:00 request is answered for 18:00 itself, not for the hours after it", () => {
  const free = ["16:00", "18:00", "18:30", "19:30"];
  const result = slotQuery({ grid: GRID, free, time: "18:00" });
  assert.equal(result.requested?.status, "free");
  assert.ok(result.availableSlots.includes("18:00") === false, "the requested time is not repeated as an alternative");
  assert.deepEqual(result.availableSlots, ["16:00", "18:30", "19:30"]);
});

test("edge first returns the earliest free time of the day", () => {
  const result = slotQuery({ grid: GRID, free: ["11:00", "16:00", "19:30"], edge: "first" });
  assert.equal(result.edgeTime, "11:00");
  assert.deepEqual(result.availableSlots, ["11:00"]);
  assert.equal(result.requested, null);
});

test("edge last returns the latest free time, so 'lo mas tarde' is 19:30 when 19:30 is free", () => {
  const result = slotQuery({ grid: GRID, free: ["11:00", "18:30", "19:30"], edge: "last" });
  assert.equal(result.edgeTime, "19:30");
  assert.deepEqual(result.availableSlots, ["19:30"]);
});

test("edge with no free time returns null and nothing to offer", () => {
  const result = slotQuery({ grid: GRID, free: [], edge: "last" });
  assert.equal(result.edgeTime, null);
  assert.deepEqual(result.availableSlots, []);
});

test("after is exclusive and pages the next free times", () => {
  const free = ["09:00", "10:00", "10:30", "11:00", "11:30", "12:00"];
  const first = slotQuery({ grid: GRID, free });
  assert.deepEqual(first.availableSlots, ["09:00", "10:00", "10:30"]);
  assert.equal(first.hasMore, true);
  const next = slotQuery({ grid: GRID, free, after: "10:30" });
  assert.deepEqual(next.availableSlots, ["11:00", "11:30", "12:00"]);
  assert.equal(next.hasMore, false);
});

test("after equal to a free time does not return that time", () => {
  const result = slotQuery({ grid: GRID, free: ["18:00", "18:30"], after: "18:00" });
  assert.deepEqual(result.availableSlots, ["18:30"]);
});

test("the default limit is the number of hours offered per reply", () => {
  assert.equal(SLOTS_OFFERED_PER_REPLY, 3);
  const free = ["09:00", "09:30", "10:00", "10:30"];
  assert.equal(slotQuery({ grid: GRID, free }).availableSlots.length, 3);
});

test("the input is not changed", () => {
  const free = ["10:30", "09:00"];
  const grid = [...GRID];
  slotQuery({ grid, free, time: "10:00" });
  assert.deepEqual(free, ["10:30", "09:00"]);
  assert.deepEqual(grid, GRID);
});

test("weekdayNameEs names the day of a real date and rejects a date that does not exist", () => {
  // 2026-11-17 is a Tuesday (martes); 2026-11-15 is a Sunday.
  assert.equal(weekdayNameEs("2026-11-17"), "martes");
  assert.equal(weekdayNameEs("2026-11-15"), "domingo");
  assert.equal(weekdayNameEs("2026-11-14"), "sábado");
  assert.equal(weekdayNameEs("2026-02-30"), null);
  assert.equal(weekdayNameEs("17/11/2026"), null);
});
