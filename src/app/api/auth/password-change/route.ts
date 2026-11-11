// src/app/api/auth/password-change/route.ts
// A signed-in CRM user changes their own password (ticket #22). It is the only API a user with a temporary
// password may call: that user has no normal session yet, so the identity comes from getSessionAccess.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-errors";
import { changeOwnPassword, type PasswordChangeAccount } from "@/lib/password-change";
import { passwordChangeDeps } from "@/lib/password-change-data";
import { isCrmRole } from "@/lib/permissions";
import { AUTH_ATTEMPTS_WINDOW_MS, rateLimited } from "@/lib/rate-limit";
import { getSessionAccess } from "@/lib/session";

// Every attempt counts (successful or not), so the current password cannot be guessed from this screen.
const ATTEMPTS_MAX = 5;
const PASSWORD_MAX = 72;

const bodySchema = z.object({
  currentPassword: z.string().max(PASSWORD_MAX),
  newPassword: z.string().max(PASSWORD_MAX),
  confirmPassword: z.string().max(PASSWORD_MAX),
});

// Who is asking: a user that owes a password change, or an active owner or staff user. Never a customer.
async function accountFromSession(): Promise<PasswordChangeAccount | null> {
  const access = await getSessionAccess();
  if (access.kind === "password_change") {
    return { tenantId: access.identity.tenantId, userId: access.identity.id, mustProveCurrent: true };
  }
  if (access.kind === "active" && isCrmRole(access.session.user.role)) {
    return { tenantId: access.session.user.tenantId, userId: access.session.user.id };
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const account = await accountFromSession();
    if (!account) return apiError("unauthorized", 401);

    if (rateLimited(`password-change:${account.userId}`, ATTEMPTS_MAX, AUTH_ATTEMPTS_WINDOW_MS)) {
      return apiError("too_many_attempts", 429);
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("validation_failed", 400);

    const result = await changeOwnPassword(passwordChangeDeps(), account, parsed.data);
    if (!result.ok) return apiError(result.reason, 400);

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Never log the password or the hash.
    console.error("[POST /api/auth/password-change] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}
