// src/app/api/apps/whatsapp/confirmations/route.ts
// GET: visits waiting for the customer's confirmation after a reminder (ADMIN and STAFF: "whatsapp.confirmations").
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/bot";
import { releaseAt } from "@/lib/reminders";
import { planLockResponse } from "@/lib/capability-guard";

export async function GET() {
  const access = await requirePermission("whatsapp.confirmations");
  if (!access.ok) return access.response;

  const { tenantId } = access;
  const denied = await planLockResponse(tenantId, "confirmations");
  if (denied) return denied;
  const now = new Date();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { confirmationDeadlineMinutes: true },
  });
  if (!tenant) return apiError("tenant_not_found", 404);

  const visits = await prisma.appointment.findMany({
    where: {
      tenantId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      reminderSentAt: { not: null },
      customerConfirmedAt: null,
      autoReleasedAt: null,
      appointmentDate: { gt: now },
    },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      appointmentDate: true,
      durationMinutes: true,
      reminderSentAt: true,
      product: { select: { name: true } },
    },
    orderBy: { appointmentDate: "asc" },
    take: 100,
  });

  return NextResponse.json({
    deadlineMinutes: tenant.confirmationDeadlineMinutes,
    items: visits.map((v) => ({
      id: v.id,
      customerName: v.customerName,
      customerPhone: v.customerPhone,
      service: v.product.name,
      appointmentDate: v.appointmentDate.toISOString(),
      durationMinutes: v.durationMinutes,
      reminderSentAt: v.reminderSentAt?.toISOString() ?? null,
      releaseAt: releaseAt(v.appointmentDate, tenant.confirmationDeadlineMinutes).toISOString(),
    })),
  });
}
