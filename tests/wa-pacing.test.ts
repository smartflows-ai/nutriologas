// tests/wa-pacing.test.ts
// Run: npx tsx --test tests/wa-pacing.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_QUIET_START_MIN,
  DEFAULT_QUIET_END_MIN,
  MAX_SENDS_PER_INSTANCE_PER_RUN,
  minutesOfDay,
  isWithinQuietHours,
  shouldHoldForQuietHours,
  underSendCap,
} from "../src/lib/wa-pacing";

test("minutesOfDay parses a business HH:MM clock string", () => {
  assert.equal(minutesOfDay("00:00"), 0);
  assert.equal(minutesOfDay("08:00"), 480);
  assert.equal(minutesOfDay("21:30"), 1290);
  assert.equal(minutesOfDay("23:59"), 1439);
});

test("defaults are 21:00 to 08:00", () => {
  assert.equal(DEFAULT_QUIET_START_MIN, 21 * 60);
  assert.equal(DEFAULT_QUIET_END_MIN, 8 * 60);
});

test("quiet window wraps midnight (21:00 to 08:00)", () => {
  const s = DEFAULT_QUIET_START_MIN;
  const e = DEFAULT_QUIET_END_MIN;
  assert.equal(isWithinQuietHours(minutesOfDay("22:30"), s, e), true); // night
  assert.equal(isWithinQuietHours(minutesOfDay("03:00"), s, e), true); // small hours
  assert.equal(isWithinQuietHours(minutesOfDay("07:59"), s, e), true);
  assert.equal(isWithinQuietHours(minutesOfDay("08:00"), s, e), false); // window end is exclusive
  assert.equal(isWithinQuietHours(minutesOfDay("12:00"), s, e), false);
  assert.equal(isWithinQuietHours(minutesOfDay("20:59"), s, e), false);
  assert.equal(isWithinQuietHours(minutesOfDay("21:00"), s, e), true); // window start is inclusive
});

test("a non-wrapping window (13:00 to 15:00, siesta) works too", () => {
  const s = 13 * 60, e = 15 * 60;
  assert.equal(isWithinQuietHours(14 * 60, s, e), true);
  assert.equal(isWithinQuietHours(16 * 60, s, e), false);
  assert.equal(isWithinQuietHours(12 * 60, s, e), false);
});

test("hold during quiet hours when there is still room after the window", () => {
  // 03:00, visit is 10 hours away: holding until 08:00 still leaves a usable window.
  assert.equal(
    shouldHoldForQuietHours({ localMin: minutesOfDay("03:00"), minutesUntilAppt: 600, quietStartMin: DEFAULT_QUIET_START_MIN, quietEndMin: DEFAULT_QUIET_END_MIN }),
    true,
  );
});

test("do not hold when the visit is too soon to wait for the window to end", () => {
  // 06:30, visit in 60 min (07:30): waiting to 08:00 would miss it. Send now rather than never.
  assert.equal(
    shouldHoldForQuietHours({ localMin: minutesOfDay("06:30"), minutesUntilAppt: 60, quietStartMin: DEFAULT_QUIET_START_MIN, quietEndMin: DEFAULT_QUIET_END_MIN }),
    false,
  );
});

test("do not hold outside quiet hours", () => {
  assert.equal(
    shouldHoldForQuietHours({ localMin: minutesOfDay("10:00"), minutesUntilAppt: 600, quietStartMin: DEFAULT_QUIET_START_MIN, quietEndMin: DEFAULT_QUIET_END_MIN }),
    false,
  );
});

test("send cap: at most N per instance per run", () => {
  assert.equal(MAX_SENDS_PER_INSTANCE_PER_RUN >= 1, true);
  assert.equal(underSendCap(0, MAX_SENDS_PER_INSTANCE_PER_RUN), true);
  assert.equal(underSendCap(MAX_SENDS_PER_INSTANCE_PER_RUN - 1, MAX_SENDS_PER_INSTANCE_PER_RUN), true);
  assert.equal(underSendCap(MAX_SENDS_PER_INSTANCE_PER_RUN, MAX_SENDS_PER_INSTANCE_PER_RUN), false);
});
