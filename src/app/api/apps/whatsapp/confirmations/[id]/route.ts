// src/app/api/apps/whatsapp/confirmations/[id]/route.ts
// POST: the owner confirms a visit or releases it now, instead of waiting for the deadline (ADMIN and STAFF:
// "whatsapp.confirmations").
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { confirmVisit, releaseVisit } from "@/lib/reminder-actions";
import { planLockResponse } from "@/lib/capability-guard";
import { AWAITING_CONFIRMATION } from "@/lib/reminders";
import { customerMeetUrl } from "@/lib/short-links";

const bodySchema = z.object({ action: z.enum(["confirm", "release"]) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requirePermission("whatsapp.confirmations");
  if (!access.ok) return access.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("reminder_settings_invalid", 400);

  const { tenantId } = access;
  const denied = await planLockResponse(tenantId, "confirmations");
  if (denied) return denied;
  const visit = await prisma.appointment.findFirst({
    where: {
      id: params.id,
      tenantId,
      ...AWAITING_CONFIRMATION,
    },
    select: {
      id: true,
      tenantId: true,
      customerPhone: true,
      customerName: true,
      appointmentDate: true,
      externalProvider: true,
      externalEventId: true,
      modality: true,
      meetUrl: true,
      meetShortCode: true,
      product: { select: { name: true } },
      tenant: { select: { name: true, slug: true, customDomain: true, messageLanguage: true, cancellationTemplate: true } },
    },
  });
  if (!visit) return apiError("appointment_not_found", 404);

  const action = {
    id: visit.id,
    tenantId: visit.tenantId,
    customerPhone: visit.customerPhone,
    customerName: visit.customerName,
    appointmentDate: visit.appointmentDate,
    externalProvider: visit.externalProvider,
    externalEventId: visit.externalEventId,
    productName: visit.product.name,
    tenantName: visit.tenant.name,
    messageLanguage: visit.tenant.messageLanguage,
    cancellationTemplate: visit.tenant.cancellationTemplate,
    modality: visit.modality,
    // The customer gets the short video link of this visit (the real one when the visit has no code).
    meetUrl: customerMeetUrl({ meetUrl: visit.meetUrl, meetShortCode: visit.meetShortCode }, visit.tenant) || null,
  };

  if (parsed.data.action === "confirm") await confirmVisit(action);
  else await releaseVisit(action);

  return NextResponse.json({ ok: true, action: parsed.data.action });
}
