// src/app/api/tenants/business/time-zone-check/route.ts
// GET: does the saved business zone tell the same hour as the zone of its saved address? (ticket #127)
// A zone picked by hand is never compared with the address on save (#111), so /admin/negocio asks here when it
// opens. Two names with the same hour all year (Monterrey and Mexico City) are not a mismatch (sameClock).
// Owner only. One Google Time Zone call per request; a failed lookup answers "no mismatch" and never blocks the page.
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { usableTimeZone } from "@/lib/tenant-time-zone";
import { lookupTimeZone, realTimeZoneLookupDeps } from "@/lib/time-zone-lookup";
import { sameClock } from "@/lib/time-zone-change";

// Reads the session on every request: never pre-rendered at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAppSession();
    if (!session?.user || session.user.role !== "ADMIN") return apiError("unauthorized", 401);

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { timeZone: true, hasPhysicalLocation: true, latitude: true, longitude: true },
    });
    const savedZone = usableTimeZone(tenant?.timeZone);
    if (!tenant?.hasPhysicalLocation || tenant.latitude == null || tenant.longitude == null) {
      return NextResponse.json({ savedZone, addressZone: null, mismatch: false });
    }

    const addressZone = await lookupTimeZone(tenant.latitude, tenant.longitude, realTimeZoneLookupDeps);
    const mismatch = addressZone !== null && !sameClock(savedZone, addressZone, new Date());
    return NextResponse.json({ savedZone, addressZone, mismatch });
  } catch (error) {
    console.error("[GET /api/tenants/business/time-zone-check] Error:", error);
    return apiError("internal_error", 500);
  }
}
