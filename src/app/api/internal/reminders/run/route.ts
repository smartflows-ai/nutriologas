// src/app/api/internal/reminders/run/route.ts
// POST: Sends due appointment reminders and releases visits nobody confirmed.
// Called every 15 min by the reminders workflow. No LLM. Body { dryRun?: boolean } lists the work without acting.
// The per-visit rules live in src/lib/reminder-run.ts; this route only loads the visits and wires the real I/O.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isInternalKeyValid } from "@/lib/bot";
import { loadReminderVisits, realReminderDeps } from "@/lib/reminder-data";
import { syncCalendarDelete } from "@/lib/calendar-sync";
import { reminderRunStatus, runReminderBatch } from "@/lib/reminder-run";

const STUCK_CALENDAR_BATCH = 20;

/** Retry: cancelled visits whose calendar event was not removed yet. The link is cleared only once the event is gone. */
async function removeStuckCalendarEvents(): Promise<{ removed: number; errors: string[] }> {
  const stuck = await prisma.appointment.findMany({
    where: { status: "CANCELLED", externalEventId: { not: null } },
    select: { id: true, tenantId: true, externalProvider: true, externalEventId: true },
    take: STUCK_CALENDAR_BATCH,
  });
  let removed = 0;
  const errors: string[] = [];
  for (const a of stuck) {
    try {
      if (await syncCalendarDelete(a.tenantId, a)) {
        await prisma.appointment.update({ where: { id: a.id }, data: { externalProvider: null, externalEventId: null } });
        removed++;
      }
    } catch (error: unknown) {
      errors.push(`${a.id}: ${error instanceof Error ? error.message : "error"}`);
    }
  }
  return { removed, errors };
}

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;
  const now = new Date();

  const visits = await loadReminderVisits(now);
  const batch = await runReminderBatch(visits, now, realReminderDeps, { dryRun });

  for (const f of batch.failures) {
    console.error("[reminders/run] failure", JSON.stringify(f));
  }

  const calendar = dryRun ? { removed: 0, errors: [] } : await removeStuckCalendarEvents();
  if (calendar.errors.length > 0) console.error("[reminders/run] calendar cleanup errors", calendar.errors);

  const status = reminderRunStatus(batch, dryRun);
  return Response.json(
    {
      success: status === 200,
      checked: visits.length,
      dryRun,
      calendarRemoved: calendar.removed,
      ...batch,
    },
    { status },
  );
}
