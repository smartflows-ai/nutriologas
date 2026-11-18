// The validation behind the shared number field: a value is committed only inside the range and on its steps.
import test from "node:test";
import assert from "node:assert/strict";
import { isValidStep } from "../src/components/ui/NumberField";

test("whole steps inside the range are valid (help minutes: 15 to 240 in steps of 15)", () => {
  assert.equal(isValidStep(15, 15, 240, 15), true);
  assert.equal(isValidStep(30, 15, 240, 15), true);
  assert.equal(isValidStep(240, 15, 240, 15), true);
  assert.equal(isValidStep(1, 15, 240, 15), false, "1 is not a step of 15");
  assert.equal(isValidStep(0, 15, 240, 15), false, "0 is below the minimum: what the old bug turned an empty field into");
  assert.equal(isValidStep(255, 15, 240, 15), false);
});

test("half hours are valid for the reminder fields (1 to 72 hours in steps of 0.5)", () => {
  assert.equal(isValidStep(3, 1, 72, 0.5), true);
  assert.equal(isValidStep(2.5, 1, 72, 0.5), true);
  assert.equal(isValidStep(2.3, 1, 72, 0.5), false);
  assert.equal(isValidStep(0.5, 0.5, 48, 0.5), true);
});

test("NaN and infinite values are never committed", () => {
  assert.equal(isValidStep(Number.NaN, 1, 72, 0.5), false);
  assert.equal(isValidStep(Number.POSITIVE_INFINITY, 1, 72, 0.5), false);
});
