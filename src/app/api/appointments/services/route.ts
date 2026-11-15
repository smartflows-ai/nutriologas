// src/app/api/appointments/services/route.ts
// Services the "Nueva cita" form of /admin/citas can book (ticket #103): only bookable, visible, not deleted.
// No price: staff does not need it to book, and the form never shows it. Permission "appointments.book".
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { requirePermission } from "@/lib/permission-guard";
import { isBookable } from "@/lib/bookable";
import { effectiveModes, modalityModeFor } from "@/lib/patient-intake";
import { getVerticalProfile } from "@/lib/vertical-profile";

const DEFAULT_DURATION = 30;

// Session-dependent: never pre-rendered at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await requirePermission("appointments.book");
    if (!access.ok) return access.response;
    const { tenantId } = access;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isBookingEnabled: true, serviceModes: true, vertical: true },
    });
    if (!tenant) return apiError("tenant_not_found", 404);

    const products = await prisma.product.findMany({
      where: { tenantId, deletedAt: null, isActive: true, requiresBooking: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, durationMinutes: true, requiresBooking: true, visitModes: true },
    });

    const services = products
      .filter((p) => isBookable(p, tenant))
      .map((p) => ({
        id: p.id,
        name: p.name,
        durationMinutes: p.durationMinutes || DEFAULT_DURATION,
        // IN_PERSON or ONLINE: the form shows it as a fact; ASK: the form asks.
        modalityMode: modalityModeFor(tenant.serviceModes, p.visitModes),
        modalities: effectiveModes(tenant.serviceModes, p.visitModes),
      }));

    return NextResponse.json({
      services,
      usesPets: getVerticalProfile(tenant.vertical, tenant.isBookingEnabled).usesPets,
    });
  } catch (error) {
    console.error("[GET /api/appointments/services] Error:", error);
    return apiError("internal_error", 500);
  }
}
