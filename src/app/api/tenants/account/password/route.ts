// src/app/api/tenants/account/password/route.ts
// The tenant owner sets or changes their own password. Only ADMIN accounts; the user comes from the session.
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { AUTH_ATTEMPTS_WINDOW_MS, rateLimited } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validations";
import { changeOwnPassword } from "@/lib/password-change";
import { passwordChangeDeps } from "@/lib/password-change-data";

// Every attempt counts (successful or not), so the current password cannot be guessed from this card.
const ATTEMPTS_MAX = 5;

// Tells the card whether to ask for the current password. Never returns the hash.
export async function GET() {
  try {
    const session = await getAppSession();
    if (!session?.user || session.user.role !== "ADMIN" || !session.user.id) {
      return apiError("unauthorized", 401);
    }
    const user = await prisma.user.findFirst({
      where: { id: session.user.id, tenantId: session.user.tenantId },
      select: { passwordHash: true },
    });
    if (!user) return apiError("unauthorized", 401);
    return NextResponse.json({ hasPassword: Boolean(user.passwordHash) });
  } catch (error) {
    console.error("[GET /api/tenants/account/password] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAppSession();
    if (!session?.user || session.user.role !== "ADMIN" || !session.user.id) {
      return apiError("unauthorized", 401);
    }

    const userId = session.user.id;
    const tenantId = session.user.tenantId;

    if (rateLimited(`password-change:${userId}`, ATTEMPTS_MAX, AUTH_ATTEMPTS_WINDOW_MS)) {
      return apiError("too_many_attempts", 429);
    }

    const json = await req.json().catch(() => null);
    const parsed = changePasswordSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", details: parsed.error.format() }, { status: 400 });
    }
    const { currentPassword, newPassword } = parsed.data;

    // Same rule as the forced change after a temporary password (src/lib/password-change.ts).
    // The user and the business come from the session, so the owner can only change their own account.
    const result = await changeOwnPassword(passwordChangeDeps(), { tenantId, userId }, {
      currentPassword: currentPassword ?? null,
      newPassword,
      confirmPassword: parsed.data.confirmPassword,
    });
    if (!result.ok) return apiError(result.reason, 400);

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never log the password or the hash.
    console.error("[PATCH /api/tenants/account/password] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}
