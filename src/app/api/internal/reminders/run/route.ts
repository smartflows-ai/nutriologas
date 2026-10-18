// src/app/api/internal/reminders/run/route.ts
// POST: Sends due appointment reminders. Called every 15 min by the reminder workflow (no LLM).
//
// Rule per appointment: among the tenant's offsets that are already reached and not yet sent,
// send ONE reminder (the closest to the appointment) and mark all reached offsets as sent.
// That way booking inside the 24 h window does not produce two messages in a row.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isInternalKeyValid, ACTIVE_APPOINTMENT_STATUSES, formatSlotTime } from "@/lib/bot";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const LOOKAHEAD_DAYS = 30; // must exceed the largest reminder offset a tenant can configure
const MAX_PER_RUN = 300;

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const now = new Date();
  const horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      appointmentDate: { gt: now, lte: horizon },
      tenant: { remindersEnabled: true },
    },
    select: {
      id: true,
      tenantId: true,
      customerPhone: true,
      appointmentDate: true,
      durationMinutes: true,
      remindersSent: true,
      product: { select: { name: true } },
      tenant: { select: { name: true, reminderOffsetsMinutes: true } },
    },
    orderBy: { appointmentDate: "asc" },
    take: MAX_PER_RUN,
  });

  const result = { checked: appointments.length, sent: 0, marked: 0, failed: 0 };

  for (const appt of appointments) {
    const apptTime = appt.appointmentDate.getTime();
    const alreadySent = appt.remindersSent;

    // Offsets whose send moment has passed and that were not sent yet.
    const reached = appt.tenant.reminderOffsetsMinutes
      .filter((offset) => !alreadySent.includes(offset))
      .filter((offset) => now.getTime() >= apptTime - offset * 60000);

    if (reached.length === 0) continue;

    const nextSent = [...alreadySent, ...reached];

    // No phone on file: nothing to send, mark so it is not rescanned forever.
    if (!appt.customerPhone) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { remindersSent: nextSent } });
      result.marked++;
      continue;
    }

    const time = formatSlotTime(appt.appointmentDate);
    const date = appt.appointmentDate.toLocaleDateString("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const text =
      `Recordatorio de tu cita en *${appt.tenant.name}*.\n\n` +
      `*Servicio:* ${appt.product.name}\n` +
      `*Fecha:* ${date}\n` +
      `*Hora:* ${time}\n` +
      `*Duración:* ${appt.durationMinutes} min\n\n` +
      `Si necesitas cambiarla o cancelarla, responde a este mensaje.`;

    const sendResult = await sendWhatsAppMessage({
      tenantId: appt.tenantId,
      to: appt.customerPhone,
      text,
    });

    if (!sendResult.success) {
      // Leave remindersSent untouched so the next run retries.
      console.error("[reminders/run] Send failed:", appt.id, sendResult.reason);
      result.failed++;
      continue;
    }

    await prisma.appointment.update({ where: { id: appt.id }, data: { remindersSent: nextSent } });
    result.sent++;
  }

  return Response.json({ success: true, ...result });
}
