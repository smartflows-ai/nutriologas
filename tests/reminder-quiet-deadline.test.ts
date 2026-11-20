// tests/reminder-quiet-deadline.test.ts
// Run: npx tsx --test tests/reminder-quiet-deadline.test.ts
// QA 2026-11-20 regression: visit at 10:00, reminder 12 h before (22:00, quiet hours), release 2 h before (08:00).
// Before the fix the reminder was held until 08:00, said "confirm before 08:00" and the visit was released at 08:15.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runReminderBatch, type ReminderDeps, type ReminderVisit, type ReminderTenant } from "../src/lib/reminder-run";
import { DEFAULT_TIME_ZONE } from "../src/lib/clinic-time";

function scenario() {
  const tenant: ReminderTenant = {
    name: "Clinica",
    messageLanguage: "es",
    timeZone: DEFAULT_TIME_ZONE,
    reminderLeadMinutes: 720,
    confirmationRequired: true,
    confirmationDeadlineMinutes: 120,
    reminderTemplate: null,
    confirmationTemplate: null,
    cancellationTemplate: null,
    messagingPolicyMode: "SHADOW",
    quietHoursStartMin: 21 * 60,
    quietHoursEndMin: 8 * 60,
  };
  const visit = {
    id: "v1",
    tenantId: "t1",
    customerPhone: "5215555555555",
    customerName: "Ana Lopez",
    appointmentDate: new Date("2026-11-21T16:00:00Z"), // 10:00 business time
    createdAt: new Date("2026-11-10T16:00:00Z"),
    reminderSentAt: null as Date | null,
    reminderAttempts: 0,
    customerConfirmedAt: null,
    autoReleasedAt: null as Date | null,
    externalProvider: null,
    externalEventId: null,
    productName: "Consulta",
    tenant,
    optedOutAt: null,
    whatsappConsentAt: null,
  } as unknown as ReminderVisit & { reminderSentAt: Date | null; autoReleasedAt: Date | null };
  const sends: Date[] = [];
  const releases: Date[] = [];
  let clock = new Date(0);
  const deps: ReminderDeps = {
    send: async () => {
      sends.push(clock);
      return { success: true };
    },
    recordFailure: async () => undefined,
    markSent: async (_id, at) => {
      (visit as { reminderSentAt: Date | null }).reminderSentAt = at;
    },
    charge: async () => undefined,
    release: async (_v, at) => {
      releases.push(at);
      (visit as { autoReleasedAt: Date | null }).autoReleasedAt = at;
      return { customerNotified: true };
    },
  } as ReminderDeps;
  const run = async (iso: string) => {
    clock = new Date(iso);
    return runReminderBatch([visit], clock, deps, { dryRun: false });
  };
  return { run, sends, releases };
}

test("a night reminder whose deadline is before the quiet window ends goes out at night, not after the deadline", async () => {
  const s = scenario();
  const first = await s.run("2026-11-21T04:00:00Z"); // 22:00 the night before
  assert.equal(first.sent, 1);
  assert.equal(first.deferred, 0);
  await s.run("2026-11-21T13:45:00Z"); // 07:45, before the deadline: nothing to release
  assert.equal(s.releases.length, 0);
});

test("the reminder job marks its sends urgent so the messaging service does not hold them again", () => {
  const source = readFileSync("src/lib/reminder-data.ts", "utf8");
  const send = source.slice(source.indexOf("send: (visit, text)"), source.indexOf("markSent:"));
  assert.match(send, /urgent: true/);
});
