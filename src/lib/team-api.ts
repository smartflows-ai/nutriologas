// src/lib/team-api.ts
// Shared pieces of the two team routes (/api/admin/users and /api/admin/users/[id]).
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import type { PermissionResult } from "@/lib/permission-guard";
import { AUTH_ATTEMPTS_WINDOW_MS, rateLimited } from "@/lib/rate-limit";
import type { StaffActor, StaffFailure } from "@/lib/staff-users";

// A response that carries a temporary password or the staff list must never be cached anywhere.
export const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

// Creating users and resetting passwords are rare: a low limit per owner slows abuse of a stolen session.
const TEAM_WRITES_MAX = 20;

const STATUS_BY_FAILURE: Record<StaffFailure, number> = {
  email_already_registered: 409,
  user_limit_reached: 409,
  user_not_found: 404,
};

// The signed-in owner, from the session only.
export function teamActor(guard: Extract<PermissionResult, { ok: true }>): StaffActor {
  return { tenantId: guard.tenantId, userId: guard.session.user.id };
}

export function teamWritesExceeded(actor: StaffActor): boolean {
  return rateLimited(`team-write:${actor.userId}`, TEAM_WRITES_MAX, AUTH_ATTEMPTS_WINDOW_MS);
}

export function staffFailure(reason: StaffFailure): NextResponse {
  return apiError(reason, STATUS_BY_FAILURE[reason]);
}
