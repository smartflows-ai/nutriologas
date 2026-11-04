// Ticket #16: run the real reminder job on ONE test visit with a simulated clock, so the flow can be checked in minutes.
// It uses the same code as production (src/lib/reminder-data.ts + reminder-run.ts); only "what time it is" changes.
//
//   npx tsx --env-file=.env local-utils/reminder-sim.ts --id <appointmentId> --mode fail|send|release [--yes]
//
// fail    clock = reminder due time + 1 min, the send is FORCED to fail. No WhatsApp goes out. Writes the failed attempt.
// send    clock = reminder due time + 1 min, REAL WhatsApp to the visit's phone, marks it sent and charges the tenant.
// release clock = confirmation deadline + 1 min, releases the visit (REAL cancellation text) if it was not confirmed.
// Without --yes it only prints what it would do. It refuses any visit whose customer name is not one of TEST_NAMES.
import { prisma } from "../src/lib/db";
import { loadReminderVisits, realReminderDeps } from "../src/lib/reminder-data";
import { runReminderBatch, type ReminderDeps } from "../src/lib/reminder-run";
import { planReminder, releaseAt } from "../src/lib/reminders";

// Only visits with one of these customer names can be simulated, so a real patient is never touched.
const TEST_NAMES = ["PRUEBA #16", "prueba local"];
const MINUTE_MS = 60_000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const id = arg("id");
  const mode = arg("mode");
  const confirmed = process.argv.includes("--yes");
  if (!id || !["fail", "send", "release"].includes(mode ?? "")) {
    throw new Error("usage: --id <appointmentId> --mode fail|send|release [--yes]");
  }

  const row = await prisma.appointment.findUnique({ where: { id }, select: { customerName: true } });
  if (!row?.customerName || !TEST_NAMES.includes(row.customerName)) throw new Error(`refused: the customer name is not one of ${TEST_NAMES.map((n) => `"${n}"`).join(", ")}`);

  const [visit] = await loadReminderVisits(new Date(), id);
  if (!visit) throw new Error("visit not found or no longer active");

  const t = visit.tenant;
  const plan = planReminder({
    apptStart: visit.appointmentDate,
    createdAt: visit.createdAt,
    leadMinutes: t.reminderLeadMinutes,
    deadlineMinutes: t.confirmationDeadlineMinutes,
    confirmationRequired: t.confirmationRequired,
  });
  const clock =
    mode === "release"
      ? new Date(releaseAt(visit.appointmentDate, t.confirmationDeadlineMinutes).getTime() + MINUTE_MS)
      : new Date(plan.sendAt.getTime() + MINUTE_MS);

  console.log(`mode=${mode} simulated clock=${clock.toISOString()} (real now=${new Date().toISOString()})`);
  console.log(`visit starts ${visit.appointmentDate.toISOString()}, reminder due ${plan.sendAt.toISOString()}, confirmation asked=${plan.requestConfirmation}`);
  console.log(`sent already=${Boolean(visit.reminderSentAt)} attempts=${visit.reminderAttempts} phone=${visit.customerPhone ? "set" : "missing"}`);
  if (!confirmed) {
    console.log("dry: nothing executed. Add --yes to run.");
    return;
  }

  const deps: ReminderDeps =
    mode === "fail"
      ? { ...realReminderDeps, send: async () => ({ success: false, reason: "simulated failure (ticket #16 test)" }) }
      : realReminderDeps;

  const result = await runReminderBatch([visit], clock, deps, { dryRun: false });
  console.log(JSON.stringify({ sent: result.sent, released: result.released, skipped: result.skipped, failed: result.failed, failures: result.failures }, null, 2));
}

main()
  .catch((e: unknown) => console.error("failed:", e instanceof Error ? e.message : "error"))
  .finally(() => prisma.$disconnect());
