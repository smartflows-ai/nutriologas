// tests/availability-message.test.ts
// Ticket #140 (run 22453): the tool answered correctly (no more times that day) and the model added "hubo un error".
// The sentence the tool returns now says it is not an error. Run with: npx tsx --test tests/availability-message.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { availabilityMessage } from "../src/lib/availability-message";
import type { SlotQueryResult } from "../src/lib/slot-query";

const ctx = { pastDate: false, closedDay: false, serviceTooLong: false, durationMinutes: 30 };
const empty = { requested: null, edgeTime: null, availableSlots: [], hasMore: false } as unknown as SlotQueryResult;

test("a day with no more times says it is not an error and tells the agent to offer another day", () => {
  const message = availabilityMessage("2026-11-21", empty, ctx);
  assert.match(message, /2026-11-21/);
  assert.match(message, /no es un error/i);
  assert.match(message, /otro dia/i);
});

test("the other sentences keep working", () => {
  const some = { requested: null, edgeTime: null, availableSlots: ["09:00", "10:00"], hasMore: false } as unknown as SlotQueryResult;
  assert.match(availabilityMessage("2026-11-21", some, ctx), /Hay horarios disponibles el 2026-11-21/);
  assert.match(availabilityMessage("2026-11-21", empty, { ...ctx, closedDay: true }), /no atiende/);
  assert.match(availabilityMessage("2026-11-01", empty, { ...ctx, pastDate: true }), /ya pasó/);
});
