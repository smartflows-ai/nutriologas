// src/app/api/internal/bot/confirm/route.ts
// POST: The customer answered the reminder. A clear "sí" confirms the visit waiting for an answer.
// Body: { instance, customerPhone, text? }. With text, only a clear confirmation counts; without text
// (the agent's confirm tool, after the customer confirmed in their own words) the visit is confirmed.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isInternalKeyValid, resolveBotTenant, ACTIVE_APPOINTMENT_STATUSES } from "@/lib/bot";
import { patientKeyOf } from "@/lib/patient-key";
import { clinicLongDate, clinicTime, customerTexts, renderTemplate } from "@/lib/reminder-messages";

const CONFIRM_WORDS = /^(si|confirmo|confirmada|confirmado|ok|okay|de acuerdo|claro|perfecto|va|sale|dale|sip|simon|listo)\b/;
const NOT_A_CONFIRMATION = /\b(no|cancel|cambi|mover|reagend|otra|otro|despues|luego|pero)/;
const MAX_WORDS = 5;

/** A short reply that clearly says yes and nothing about changing or cancelling. */
export function isClearConfirmation(text: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.split(" ").length > MAX_WORDS) return false;
  if (NOT_A_CONFIRMATION.test(normalized)) return false;
  return CONFIRM_WORDS.test(normalized);
}

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, customerPhone, text } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  const key = patientKeyOf(customerPhone);
  if (!key) return Response.json({ handled: false });

  const now = new Date();
  const appointment = await prisma.appointment.findFirst({
    where: {
      tenantId: bot.tenantId,
      patientKey: key,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      reminderSentAt: { not: null },
      customerConfirmedAt: null,
      autoReleasedAt: null,
      appointmentDate: { gt: now },
    },
    orderBy: { appointmentDate: "asc" },
    select: { id: true, appointmentDate: true, product: { select: { name: true } } },
  });

  // Nothing waiting for an answer: the message goes to the bot agent as a normal chat message.
  if (!appointment) return Response.json({ handled: false });

  if (typeof text === "string" && !isClearConfirmation(text)) {
    return Response.json({ handled: false, awaiting: true });
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { customerConfirmedAt: now, status: "CONFIRMED" },
  });

  const tenant = await prisma.tenant.findUnique({ where: { id: bot.tenantId }, select: { name: true, messageLanguage: true } });
  const language = tenant?.messageLanguage ?? "es";
  const reply = renderTemplate(customerTexts(language).confirmedReply, {
    servicio: appointment.product.name,
    fecha: clinicLongDate(appointment.appointmentDate, language),
    hora: clinicTime(appointment.appointmentDate, language),
    negocio: tenant?.name ?? "",
  });

  return Response.json({ handled: true, confirmed: true, reply, appointmentId: appointment.id });
}
