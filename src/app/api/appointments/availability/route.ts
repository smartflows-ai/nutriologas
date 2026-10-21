// src/app/api/appointments/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clinicDateTime } from "@/lib/clinic-time";
import { getBusyPeriods, isSlotFree } from "@/lib/calendar-sync";
import { daySlots, parseBusinessHours } from "@/lib/business-hours";
import { isBookable } from "@/lib/bookable";

import { resolveTenantSlug } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

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
      select: { id: true, isBookingEnabled: true, businessHours: true },
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
    const candidates = daySlots(hours, dateStr, duration);

    // Same rule as booking: a slot is free only when no native appointment or calendar event overlaps it.
    const busy = await getBusyPeriods(tenant.id, dateStr);
    const now = Date.now();
    const availableSlots = candidates.filter((time) => {
      const start = new Date(clinicDateTime(dateStr, time));
      if (start.getTime() <= now) return false;
      const end = new Date(start.getTime() + duration * 60000);
      return isSlotFree(busy, start, end);
    });

    return NextResponse.json({
      productId: product.id,
      productName: product.name,
      durationMinutes: duration,
      price: product.price,
      date: dateStr,
      availableSlots,
    });
  } catch (error: any) {
    console.error("[GET /api/appointments/availability] Error:", error);
    return apiError("internal_error", 500);
  }
}
