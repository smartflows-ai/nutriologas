// src/app/api/admin/historial/route.ts
// GET: patients of the tenant with visit and note counts. ADMIN and STAFF ("history.view"); the notes count
// only goes to roles that may read notes.
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { listPatients } from "@/lib/patients";
import { prisma } from "@/lib/db";
import { getVerticalProfile } from "@/lib/vertical-profile";
import { planLockResponse } from "@/lib/capability-guard";
import { requirePermission } from "@/lib/permission-guard";
import { omitNoteCounts } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  try {
    const access = await requirePermission("history.view");
    if (!access.ok) return access.response;
    const { tenantId, role } = access;
    const denied = await planLockResponse(tenantId, "history");
    if (denied) return denied;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").slice(0, 80);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { vertical: true, isBookingEnabled: true },
    });
    const withPets = getVerticalProfile(tenant?.vertical, tenant?.isBookingEnabled ?? false).usesPets;

    const { patients, total } = await listPatients(tenantId, q, page, PAGE_SIZE, withPets);
    return NextResponse.json({ patients: omitNoteCounts(role, patients), total, pageSize: PAGE_SIZE, withPets });
  } catch (error) {
    console.error("[GET /api/admin/historial] Error:", error);
    return apiError("internal_error", 500);
  }
}
