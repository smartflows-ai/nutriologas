// src/app/api/appointments/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clinicDateTime } from "@/lib/clinic-time";
import { getBusyPeriods, isSlotFree } from "@/lib/calendar-sync";

import { resolveTenantSlug } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const DAYS_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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
      select: { id: true },
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

    const duration = product.durationMinutes || 30;
    const requestedDate = new Date(`${dateStr}T00:00:00.000Z`);
    const dayOfWeek = DAYS_MAP[requestedDate.getUTCDay()];

    // Obtener slots base desde serviceConfig si existen
    const serviceConfig = (product.serviceConfig as any) || {};
    let baseSlots: string[] = [];

    if (serviceConfig?.availableSlots && Array.isArray(serviceConfig.availableSlots[dayOfWeek])) {
      baseSlots = serviceConfig.availableSlots[dayOfWeek];
    } else {
      // Horario estándar: Lunes a Sábado de 09:00 a 18:00
      if (dayOfWeek !== "sunday") {
        const startHour = 9;
        const endHour = 18;
        const slots: string[] = [];

        for (let h = startHour; h < endHour; h++) {
          for (let m = 0; m < 60; m += duration) {
            if (m + duration > 60 && m !== 0) continue;
            const hourStr = h.toString().padStart(2, "0");
            const minStr = m.toString().padStart(2, "0");
            slots.push(`${hourStr}:${minStr}`);
          }
        }
        baseSlots = slots;
      }
    }

    // Same rule as booking: a slot is free only when no native appointment or calendar event overlaps it.
    const busy = await getBusyPeriods(tenant.id, dateStr);
    const availableSlots = baseSlots.filter((time) => {
      const start = new Date(clinicDateTime(dateStr, time));
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
