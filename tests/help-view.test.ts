// How a chat that needs help is shown: its tone (color), how long it has waited and the label of its reason.
import test from "node:test";
import assert from "node:assert/strict";
import { helpTone, needsHelp, reasonLabelKey, waitingParts } from "../src/lib/help-view";

const NOW = new Date("2026-11-18T16:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

test("no help is no tone, medium is medium, high and critical are high", () => {
  assert.equal(helpTone(0), "none");
  assert.equal(helpTone(1), "medium");
  assert.equal(helpTone(2), "high");
  assert.equal(helpTone(3), "high");
  assert.equal(helpTone(undefined), "none");
});

test("a chat needs help only with a priority above none", () => {
  assert.equal(needsHelp({ helpPriority: 0 }), false);
  assert.equal(needsHelp({}), false);
  assert.equal(needsHelp({ helpPriority: 1 }), true);
});

test("the wait is shown in minutes below an hour and in whole hours after", () => {
  assert.deepEqual(waitingParts(NOW, minutesAgo(0)), { value: 0, unit: "minutes" });
  assert.deepEqual(waitingParts(NOW, minutesAgo(12)), { value: 12, unit: "minutes" });
  assert.deepEqual(waitingParts(NOW, minutesAgo(59)), { value: 59, unit: "minutes" });
  assert.deepEqual(waitingParts(NOW, minutesAgo(60)), { value: 1, unit: "hours" });
  assert.deepEqual(waitingParts(NOW, minutesAgo(190)), { value: 3, unit: "hours" });
});

test("a missing or future time shows nothing or zero instead of a negative wait", () => {
  assert.equal(waitingParts(NOW, null), null);
  assert.deepEqual(waitingParts(NOW, new Date(NOW.getTime() + 60000)), { value: 0, unit: "minutes" });
});

test("the wait accepts the ISO string the API returns", () => {
  assert.deepEqual(waitingParts(NOW, minutesAgo(5).toISOString()), { value: 5, unit: "minutes" });
  assert.equal(waitingParts(NOW, "not a date"), null);
});

test("the label key comes from the registry and an unknown reason has none", () => {
  assert.equal(reasonLabelKey("person_requested"), "person");
  assert.equal(reasonLabelKey("unanswered_long"), "unanswered");
  assert.equal(reasonLabelKey("owner_reply"), null);
  assert.equal(reasonLabelKey(null), null);
});
