// src/app/api/apps/whatsapp/confirmations/route.ts
// GET: visits waiting for the customer's confirmation after a reminder (ADMIN only).
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/bot";
import { releaseAt } from "@/lib/reminders";

export async function GET() {
  const session = await getAppSession();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("unauthorized", 401);

  const tenantId = session.user.tenantId;
  const now = new Date();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { confirmationDeadlineHours: true },
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
    deadlineHours: tenant.confirmationDeadlineHours,
    items: visits.map((v) => ({
      id: v.id,
      customerName: v.customerName,
      customerPhone: v.customerPhone,
      service: v.product.name,
      appointmentDate: v.appointmentDate.toISOString(),
      durationMinutes: v.durationMinutes,
      reminderSentAt: v.reminderSentAt?.toISOString() ?? null,
      releaseAt: releaseAt(v.appointmentDate, tenant.confirmationDeadlineHours).toISOString(),
    })),
  });
}
