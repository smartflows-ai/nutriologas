// src/app/api/tenants/business/time-zone-impact/route.ts
// GET ?zone=<IANA>: the owner's future active visits whose day or hour reads differently on that zone (ticket #127).
// /admin/negocio shows them before saving a new zone; PATCH /api/tenants/business asks for the same confirmation.
// Owner only. The tenant comes from the session, never from the query.
import { NextRequest, NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { apiError } from "@/lib/api-errors";
import { isValidTimeZone } from "@/lib/clinic-time";
import { loadZoneShift } from "@/lib/time-zone-change-data";

/** Rows sent to the screen; the count is always the full one. */
const MAX_ROWS = 20;

// Reads the session on every request: never pre-rendered at build time.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAppSession();
    if (!session?.user || session.user.role !== "ADMIN") return apiError("unauthorized", 401);

    const zone = req.nextUrl.searchParams.get("zone");
    if (!isValidTimeZone(zone)) return apiError("time_zone_invalid", 400);

    const shift = await loadZoneShift(session.user.tenantId, zone);
    return NextResponse.json({
      fromZone: shift.fromZone,
      toZone: shift.toZone,
      count: shift.visits.length,
      visits: shift.visits.slice(0, MAX_ROWS),
    });
  } catch (error) {
    console.error("[GET /api/tenants/business/time-zone-impact] Error:", error);
    return apiError("internal_error", 500);
  }
}
