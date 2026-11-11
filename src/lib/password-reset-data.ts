// src/lib/password-reset-data.ts
// Real database and sender for the password reset (the routes use these; the rules are in password-reset.ts).
import { prisma } from "@/lib/db";
import { sendPlatformWhatsAppMessage } from "@/lib/platform-whatsapp";
import { generateResetCode } from "@/lib/password-reset-code";
import type { ResetDeps, ResetTenant, ResetUser } from "@/lib/password-reset";
import { resolveTenantSlug } from "@/lib/tenant";
import { ADMIN_ROLE, STAFF_ROLE } from "@/lib/permissions";
import { hashPassword } from "@/lib/password-hash";

export function resetDeps(secret: string): ResetDeps {
  return {
    async findCrmUserByEmail(tenantId: string, email: string): Promise<ResetUser | null> {
      const user = await prisma.user.findFirst({
        // A deactivated user is treated like an unknown email: no code is sent (ticket #22).
        where: { tenantId, email, isActive: true, role: { in: [ADMIN_ROLE, STAFF_ROLE] } },
        select: {
          id: true,
          email: true,
          role: true,
          passwordHash: true,
          passwordResetCodeHash: true,
          passwordResetExpiresAt: true,
          passwordResetAttempts: true,
        },
      });
      // The query already limits the role; this narrows the type for the pure logic.
      if (!user || (user.role !== ADMIN_ROLE && user.role !== STAFF_ROLE)) return null;
      return { ...user, role: user.role };
    },
    async findTenant(tenantId: string): Promise<ResetTenant | null> {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, whatsappNumber: true, messageLanguage: true },
      });
      if (!tenant) return null;
      return {
        id: tenant.id,
        name: tenant.name,
        whatsappNumber: tenant.whatsappNumber,
        messageLanguage: tenant.messageLanguage === "en" ? "en" : "es",
      };
    },
    async saveResetCode(userId: string, codeHash: string, expiresAt: Date): Promise<void> {
      await prisma.user.update({
        where: { id: userId },
        data: { passwordResetCodeHash: codeHash, passwordResetExpiresAt: expiresAt, passwordResetAttempts: 0 },
      });
    },
    async bumpAttempts(userId: string): Promise<void> {
      await prisma.user.update({
        where: { id: userId },
        data: { passwordResetAttempts: { increment: 1 } },
      });
    },
    async saveNewPassword(userId: string, passwordHash: string): Promise<void> {
      // Clears the reset fields in the same write, so the code cannot be used twice.
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          // The user chose this password and the owner shared the code, so a temporary password is settled.
          mustChangePassword: false,
          // A forgotten password may mean someone else has the account: every earlier session ends.
          sessionVersion: { increment: 1 },
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetAttempts: 0,
        },
      });
    },
    sendCode: (to: string, text: string) => sendPlatformWhatsAppMessage({ to, text }),
    hashPassword,
    generateCode: () => generateResetCode(),
    secret,
    now: () => new Date(),
  };
}

// The tenant comes from the host, never from the body (same rule as login).
export async function tenantIdFromHost(host: string): Promise<string | null> {
  const slug = resolveTenantSlug(host);
  if (!slug) return null;
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug }, { customDomain: slug }] },
    select: { id: true },
  });
  return tenant?.id ?? null;
}
