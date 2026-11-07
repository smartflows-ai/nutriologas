// src/app/api/auth/password-reset/request/route.ts
// Asks for a reset code. Always answers the same way, so the reply never shows whether an account exists.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-errors";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { requestResetCode } from "@/lib/password-reset";
import { resetDeps, tenantIdFromHost } from "@/lib/password-reset-data";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 3; // per email and business
const MAX_PER_IP = 10;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return apiError("internal_error", 500);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("validation_failed", 400);
    const { email } = parsed.data;

    const tenantId = await tenantIdFromHost(req.headers.get("host") || "");
    if (!tenantId) return apiError("tenant_not_found", 400);

    if (
      rateLimited(`reset-request:${tenantId}:${email}`, MAX_PER_EMAIL, WINDOW_MS) ||
      rateLimited(`reset-request-ip:${clientIp(req)}`, MAX_PER_IP, WINDOW_MS)
    ) {
      return apiError("too_many_attempts", 429);
    }

    // The result is logged without the email; the reply is the same whatever it is.
    const result = await requestResetCode(resetDeps(secret), tenantId, email);
    console.info("[password-reset] request result:", result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/auth/password-reset/request] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}
