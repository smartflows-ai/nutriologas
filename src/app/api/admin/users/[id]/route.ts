// src/app/api/admin/users/[id]/route.ts
// The owner's team (ticket #22): reset a staff user's password, deactivate or activate the account.
// Only a role with "users.manage" (the owner). The business always comes from the session, and the rules
// only act on STAFF users of that business: any other id answers 404.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-errors";
import { requirePermission } from "@/lib/permission-guard";
import { resetStaffPassword, setStaffActive } from "@/lib/staff-users";
import { staffDeps } from "@/lib/staff-users-data";
import { NO_STORE, staffFailure, teamActor, teamWritesExceeded } from "@/lib/team-api";

const ID_MAX = 64;
const actionSchema = z.object({ action: z.enum(["reset_password", "deactivate", "activate"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("users.manage");
  if (!guard.ok) return guard.response;
  try {
    const actor = teamActor(guard);
    if (teamWritesExceeded(actor)) return apiError("too_many_attempts", 429);

    const { id } = await params;
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success || !id || id.length > ID_MAX) return apiError("validation_failed", 400);

    if (parsed.data.action === "reset_password") {
      const result = await resetStaffPassword(staffDeps(), actor, id);
      // The temporary credential is returned once and stored nowhere in clear.
      return result.ok ? NextResponse.json({ tempPassword: result.tempPassword }, NO_STORE) : staffFailure(result.reason);
    }

    const result = await setStaffActive(staffDeps(), actor, id, parsed.data.action === "activate");
    return result.ok ? NextResponse.json({ ok: true }, NO_STORE) : staffFailure(result.reason);
  } catch (error) {
    console.error("[PATCH /api/admin/users/[id]] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}
