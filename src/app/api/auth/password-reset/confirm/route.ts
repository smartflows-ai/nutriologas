// src/app/api/auth/password-reset/confirm/route.ts
// Checks the code and sets the new password.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, type ApiErrorCode } from "@/lib/api-errors";
import { rateLimited } from "@/lib/rate-limit";
import { confirmResetCode, type ConfirmFailure } from "@/lib/password-reset";
import { resetDeps, tenantIdFromHost } from "@/lib/password-reset-data";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_CONFIRM_PER_EMAIL = 10; // on top of the 5 wrong codes stored on the account

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().max(72),
  confirmPassword: z.string().max(72),
});

// Each failure becomes an API error key (translated by the UI).
const FAILURE_CODE: Record<ConfirmFailure, ApiErrorCode> = {
  wrong_code: "reset_code_invalid",
  expired: "reset_code_expired",
  too_many_attempts: "reset_code_attempts_used",
  password_mismatch: "password_mismatch",
  password_too_short: "password_too_short",
  password_too_long: "password_too_long",
  password_common: "password_common",
  password_same_as_current: "password_same_as_current",
};

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return apiError("internal_error", 500);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("validation_failed", 400);
    const { email, code, newPassword, confirmPassword } = parsed.data;

    const tenantId = await tenantIdFromHost(req.headers.get("host") || "");
    if (!tenantId) return apiError("tenant_not_found", 400);

    if (rateLimited(`reset-confirm:${tenantId}:${email}`, MAX_CONFIRM_PER_EMAIL, WINDOW_MS)) {
      return apiError("too_many_attempts", 429);
    }

    const result = await confirmResetCode(resetDeps(secret), tenantId, email, code, newPassword, confirmPassword);
    if (!result.ok) return apiError(FAILURE_CODE[result.reason], 400);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/auth/password-reset/confirm] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}
