// src/app/api/appointments/known-patient/route.ts
// The "Nueva cita" form looks up a phone while it is typed (ticket #103): name, age and email of the latest visit of
// that number in this business (deleted visits skipped), so a known patient is not asked twice.
// Permission "appointments.book"; scoped to the session's business; rate limited per user.
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { requirePermission } from "@/lib/permission-guard";
import { patientKeyOf } from "@/lib/patient-key";
import { getKnownPatient } from "@/lib/patients";
import { rateLimited } from "@/lib/rate-limit";

const LOOKUPS_PER_MINUTE = 60;
const MINUTE_MS = 60_000;

// Session-dependent: never pre-rendered at build time.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const access = await requirePermission("appointments.book");
    if (!access.ok) return access.response;
    const { tenantId, session } = access;

    if (rateLimited(`known-patient:${tenantId}:${session.user.id}`, LOOKUPS_PER_MINUTE, MINUTE_MS)) {
      return apiError("too_many_attempts", 429);
    }

    const key = patientKeyOf(new URL(req.url).searchParams.get("phone"));
    if (!key) return apiError("phone_required", 400);

    const patient = await getKnownPatient(tenantId, key);
    return NextResponse.json({ patient }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/appointments/known-patient] Error:", error);
    return apiError("internal_error", 500);
  }
}
