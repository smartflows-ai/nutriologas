// src/app/api/appointments/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchExternalAppointments } from "@/lib/external-calendar";
import { CLINIC_TIME_OFFSET, clinicTimeOf } from "@/lib/clinic-time";

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

    // Consultar citas existentes para ese día
    const startOfDay = new Date(`${dateStr}T00:00:00.000${CLINIC_TIME_OFFSET}`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999${CLINIC_TIME_OFFSET}`);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        productId,
        status: { notIn: ["CANCELLED"] },
        appointmentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: { appointmentDate: true },
    });

    const occupiedHours = new Set(
      existingAppointments.map((a) => clinicTimeOf(new Date(a.appointmentDate)))
    );

    try {
      const externalAppts = await fetchExternalAppointments(
        tenant.id, 
        startOfDay.toISOString(), 
        endOfDay.toISOString()
      );
      
      externalAppts.forEach(app => {
        const d = new Date(app.appointmentDate);
        const startTime = clinicTimeOf(d);
        const [startHour, startMinute] = startTime.split(":").map(Number);

        // Mark the start time as occupied
        occupiedHours.add(startTime);

        // Also mark subsequent slots based on duration to prevent overlapping
        const appDuration = app.durationMinutes || 30;
        let currentMinutes = startHour * 60 + startMinute;
        const endMinutes = currentMinutes + appDuration;
        
        // Mark every slot that starts within the duration of this appointment
        // We check every 15-minute interval as that's a common minimum slot size
        for (let m = currentMinutes + 15; m < endMinutes; m += 15) {
          const h = Math.floor(m / 60).toString().padStart(2, "0");
          const min = (m % 60).toString().padStart(2, "0");
          occupiedHours.add(`${h}:${min}`);
        }
      });
    } catch (extErr) {
      console.warn("[GET /api/appointments/availability] External calendar sync error:", extErr);
    }

    // Filtrar slots libres
    const availableSlots = baseSlots.filter((slot) => !occupiedHours.has(slot));

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
