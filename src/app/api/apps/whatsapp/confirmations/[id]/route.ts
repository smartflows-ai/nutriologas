// src/app/api/apps/whatsapp/confirmations/[id]/route.ts
// POST: the owner confirms a visit or releases it now, instead of waiting for the deadline (ADMIN only).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/bot";
import { confirmVisit, releaseVisit } from "@/lib/reminder-actions";

const bodySchema = z.object({ action: z.enum(["confirm", "release"]) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getAppSession();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("unauthorized", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("reminder_settings_invalid", 400);

  const tenantId = session.user.tenantId;
  const visit = await prisma.appointment.findFirst({
    where: {
      id: params.id,
      tenantId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      reminderSentAt: { not: null },
      customerConfirmedAt: null,
      autoReleasedAt: null,
    },
    select: {
      id: true,
      tenantId: true,
      customerPhone: true,
      appointmentDate: true,
      externalProvider: true,
      externalEventId: true,
      product: { select: { name: true } },
      tenant: { select: { name: true, messageLanguage: true, cancellationTemplate: true } },
    },
  });
  if (!visit) return apiError("appointment_not_found", 404);

  const action = {
    id: visit.id,
    tenantId: visit.tenantId,
    customerPhone: visit.customerPhone,
    appointmentDate: visit.appointmentDate,
    externalProvider: visit.externalProvider,
    externalEventId: visit.externalEventId,
    productName: visit.product.name,
    tenantName: visit.tenant.name,
    messageLanguage: visit.tenant.messageLanguage,
    cancellationTemplate: visit.tenant.cancellationTemplate,
  };

  if (parsed.data.action === "confirm") await confirmVisit(action);
  else await releaseVisit(action);

  return NextResponse.json({ ok: true, action: parsed.data.action });
}
