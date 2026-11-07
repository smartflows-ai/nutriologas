// src/app/api/tenants/account/password/route.ts
// The tenant owner sets or changes their own password. Only ADMIN accounts; the user comes from the session.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { rateLimited } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validations";
import { passwordIssues, PASSWORD_API_ERROR } from "@/lib/password-rules";

// Every attempt counts (successful or not), so the current password cannot be guessed from this card.
const ATTEMPTS_MAX = 5;
const ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;
// Higher than the register routes (10): this changes a credential that protects the whole CRM.
const BCRYPT_ROUNDS = 12;

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

    if (rateLimited(`password-change:${userId}`, ATTEMPTS_MAX, ATTEMPTS_WINDOW_MS)) {
      return apiError("too_many_attempts", 429);
    }

    const json = await req.json().catch(() => null);
    const parsed = changePasswordSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", details: parsed.error.format() }, { status: 400 });
    }
    const { currentPassword, newPassword } = parsed.data;

    // Tenant filter as well as user id: the owner can only change a user of their own business.
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, passwordHash: true },
    });
    if (!user) return apiError("unauthorized", 401);

    // An account that already has a password must prove it first. Accounts without one may create it.
    if (user.passwordHash) {
      if (!currentPassword) return apiError("current_password_required", 400);
      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) return apiError("current_password_invalid", 400);
    }

    const [issue] = passwordIssues(newPassword, currentPassword ?? null);
    if (issue) return apiError(PASSWORD_API_ERROR[issue], 400);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never log the password or the hash.
    console.error("[PATCH /api/tenants/account/password] Error:", error instanceof Error ? error.name : "unknown");
    return apiError("internal_error", 500);
  }
}
