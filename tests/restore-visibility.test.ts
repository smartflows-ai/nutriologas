import { test } from "node:test";
import assert from "node:assert/strict";
import { canOfferReopen, canOfferRestore } from "../src/lib/appointment-admin-rules";

const START = new Date("2026-11-20T17:00:00.000Z");
const MINUTE = 60_000;

test("Recuperar shows until the visit starts and disappears at its start time", () => {
  assert.equal(canOfferRestore(START, new Date(START.getTime() - MINUTE)), true);
  assert.equal(canOfferRestore(START, START), false);
  assert.equal(canOfferRestore(START, new Date(START.getTime() + MINUTE)), false);
});

test("Reabrir follows the server rule for each inactive status", () => {
  const before = new Date(START.getTime() - MINUTE);
  const after = new Date(START.getTime() + MINUTE);
  for (const status of ["CANCELLED", "NO_SHOW", "COMPLETED"]) {
    assert.equal(canOfferReopen(status, START, before), true, `${status} before`);
  }
  // A cancelled visit whose time came cannot come back; a past no-show or attended can be corrected.
  assert.equal(canOfferReopen("CANCELLED", START, after), false);
  assert.equal(canOfferReopen("CANCELLED", START, START), false);
  assert.equal(canOfferReopen("NO_SHOW", START, after), true);
  assert.equal(canOfferReopen("COMPLETED", START, after), true);
});

test("an active visit is not offered Reabrir", () => {
  assert.equal(canOfferReopen("PENDING", START, new Date(START.getTime() - MINUTE)), false);
  assert.equal(canOfferReopen("CONFIRMED", START, new Date(START.getTime() + MINUTE)), false);
});
