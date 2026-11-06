// src/app/api/admin/historial/[key]/route.ts
// GET: one patient's visits and notes. ADMIN and STAFF ("history.view"); notes only go to roles that may read
// them. The key is digits only; anything else is rejected.
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { getPatientTimeline } from "@/lib/patients";
import { prisma } from "@/lib/db";
import { getVerticalProfile } from "@/lib/vertical-profile";
import { planLockResponse } from "@/lib/capability-guard";
import { requirePermission } from "@/lib/permission-guard";
import { omitPatientNotes } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const access = await requirePermission("history.view");
    if (!access.ok) return access.response;
    const { tenantId, role } = access;
    if (!/^\d{8,15}$/.test(params.key)) {
      return apiError("patient_not_found", 404);
    }

    const denied = await planLockResponse(tenantId, "history");
    if (denied) return denied;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { vertical: true, isBookingEnabled: true },
    });
    const withPets = getVerticalProfile(tenant?.vertical, tenant?.isBookingEnabled ?? false).usesPets;
    const petId = new URL(req.url).searchParams.get("petId");

    const timeline = await getPatientTimeline(tenantId, params.key, { withPets, petId });
    if (timeline.visits.length === 0 && timeline.orphanNotes.length === 0) {
      return apiError("patient_not_found", 404);
    }
    return NextResponse.json(omitPatientNotes(role, timeline));
  } catch (error) {
    console.error("[GET /api/admin/historial/[key]] Error:", error);
    return apiError("internal_error", 500);
  }
}
