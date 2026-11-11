// src/lib/password-change-data.ts
// Real database and hash for a user changing their own password (the rules are in password-change.ts).
import { prisma } from "@/lib/db";
import { comparePassword, hashPassword } from "@/lib/password-hash";
import type { PasswordChangeDeps } from "@/lib/password-change";

export function passwordChangeDeps(): PasswordChangeDeps {
  return {
    async findPasswordHash(tenantId: string, userId: string): Promise<string | null | undefined> {
      // Tenant and active filters as well as the id: a user only changes their own account, in their business.
      const user = await prisma.user.findFirst({
        where: { id: userId, tenantId, isActive: true },
        select: { passwordHash: true },
      });
      return user ? user.passwordHash : undefined;
    },
    comparePassword,
    hashPassword,
    async saveOwnPassword(tenantId: string, userId: string, passwordHash: string): Promise<void> {
      // The user chose this password, so the temporary-password flag goes off, and a pending reset code dies.
      await prisma.user.updateMany({
        where: { id: userId, tenantId, isActive: true },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetAttempts: 0,
        },
      });
    },
  };
}
