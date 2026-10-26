// src/app/api/admin/historial/[key]/route.ts
// GET: one patient's visits and notes. Admin only. The key is digits only; anything else is rejected.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api-errors";
import { getPatientTimeline } from "@/lib/patients";
import { prisma } from "@/lib/db";
import { getVerticalProfile } from "@/lib/vertical-profile";

export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return apiError("unauthorized", 401);
    }
    if (!/^\d{8,15}$/.test(params.key)) {
      return apiError("patient_not_found", 404);
    }

    const tenantId = (session.user as any).tenantId;
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
    return NextResponse.json(timeline);
  } catch (error) {
    console.error("[GET /api/admin/historial/[key]] Error:", error);
    return apiError("internal_error", 500);
  }
}
