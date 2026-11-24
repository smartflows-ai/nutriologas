// tests/progress-label.test.ts
// Run: npx tsx --test tests/progress-label.test.ts
// The step index of ProgressLabel: it advances one step at a time and stops at the last step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStepIndex } from "../src/components/ui/ProgressLabel";

test("advances one step at a time", () => {
  assert.equal(nextStepIndex(0, 4), 1);
  assert.equal(nextStepIndex(1, 4), 2);
});

test("stays on the last step and never goes past it", () => {
  assert.equal(nextStepIndex(3, 4), 3);
  assert.equal(nextStepIndex(9, 4), 3);
});

test("a list with no steps keeps index 0", () => {
  assert.equal(nextStepIndex(0, 0), 0);
});
