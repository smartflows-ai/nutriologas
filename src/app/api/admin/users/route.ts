// src/app/api/admin/users/route.ts
// The owner's team (ticket #22): list the staff users and create one with a temporary password.
// Only a role with "users.manage" (the owner). The business always comes from the session.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-errors";
import { requirePermission } from "@/lib/permission-guard";
import { createStaffUser } from "@/lib/staff-users";
import { staffDeps, teamOverview } from "@/lib/staff-users-data";
import { NO_STORE, staffFailure, teamActor, teamWritesExceeded } from "@/lib/team-api";

const NAME_MAX = 80;
const EMAIL_MAX = 254;

const createSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  email: z.string().trim().toLowerCase().email().max(EMAIL_MAX),
});

export async function GET() {
  const guard = await requirePermission("users.manage");
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json(await teamOverview(guard.tenantId), NO_STORE);
  } catch (error) {
    console.error("[GET /api/admin/users] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission("users.manage");
  if (!guard.ok) return guard.response;
  try {
    const actor = teamActor(guard);
    if (teamWritesExceeded(actor)) return apiError("too_many_attempts", 429);

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("validation_failed", 400);

    const result = await createStaffUser(staffDeps(), actor, parsed.data);
    if (!result.ok) return staffFailure(result.reason);

    // The temporary credential is returned once and stored nowhere in clear.
    return NextResponse.json({ user: result.user, tempPassword: result.tempPassword }, { status: 201, ...NO_STORE });
  } catch (error) {
    console.error("[POST /api/admin/users] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}
