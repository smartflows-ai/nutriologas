// src/app/api/appointments/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clinicDateTime, isRealClinicTime } from "@/lib/clinic-time";
import { getBusyPeriods, isSlotFree } from "@/lib/calendar-sync";
import { daySlots, parseBusinessHours } from "@/lib/business-hours";
import { isBookable } from "@/lib/bookable";

import { resolveTenantSlug } from "@/lib/tenant";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { apiError } from "@/lib/api-errors";
import { usableTimeZone } from "@/lib/tenant-time-zone";

export const dynamic = "force-dynamic";

/**
 * `exclude=<visit id>`: when the panel moves a visit, the visit does not block its own slot (ticket #103).
 * Only honored for an owner or staff session of this same business; anyone else gets the plain availability.
 */
async function excludedVisit(
  visitId: string | null,
  tenantId: string
): Promise<{ appointmentId: string; externalEventId: string | null } | undefined> {
  if (!visitId) return undefined;
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.tenantId !== tenantId || !can(session.user.role, "appointments.book")) return undefined;
  const visit = await prisma.appointment.findFirst({
    where: { id: visitId, tenantId, deletedAt: null },
    select: { id: true, externalEventId: true },
  });
  return visit ? { appointmentId: visit.id, externalEventId: visit.externalEventId } : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD

    if (!productId || !dateStr) {
      return apiError("service_and_date_required", 400);
    }

    const host = req.headers.get("host") || "";
    const tenantSlug = resolveTenantSlug(host);
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
      select: { id: true, isBookingEnabled: true, businessHours: true, timeZone: true },
    });

    if (!tenant) {
      return apiError("tenant_not_found", 404);
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: tenant.id, deletedAt: null },
    });

    if (!product) {
      return apiError("product_not_found", 404);
    }

    if (!isBookable(product, tenant)) {
      return apiError("not_bookable", 400);
    }

    const duration = product.durationMinutes || 30;
    const hours = parseBusinessHours(tenant.businessHours);
    const zone = usableTimeZone(tenant.timeZone);
    // A time the clock skips that day (daylight saving time starts) is never offered.
    const candidates = daySlots(hours, dateStr, duration).filter((time) => isRealClinicTime(dateStr, time, zone));

    // Same rule as booking: a slot is free only when no native appointment or calendar event overlaps it.
    const busy = await getBusyPeriods(tenant.id, dateStr, zone);
    const self = await excludedVisit(searchParams.get("exclude"), tenant.id);
    const now = Date.now();
    const availableSlots = candidates.filter((time) => {
      const start = new Date(clinicDateTime(dateStr, time, zone));
      if (start.getTime() <= now) return false;
      const end = new Date(start.getTime() + duration * 60000);
      return isSlotFree(busy, start, end, self);
    });

    return NextResponse.json({
      productId: product.id,
      productName: product.name,
      durationMinutes: duration,
      price: product.price,
      date: dateStr,
      allSlots: candidates,
      availableSlots,
    });
  } catch (error: any) {
    console.error("[GET /api/appointments/availability] Error:", error);
    return apiError("internal_error", 500);
  }
}
