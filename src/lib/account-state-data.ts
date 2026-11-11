// src/lib/account-state-data.ts
// Reads the account row for the live session check (the rules are in account-state.ts).
// One primary-key read per authenticated request, used by the NextAuth jwt callback and by getSessionAccess.
import { prisma } from "@/lib/db";
import { resolveAccountAccess, type AccountAccess } from "@/lib/account-state";

const NO_ACCESS: AccountAccess = { kind: "none" };

// Never throws: if the database cannot be read, the user gets no access for that request (fail closed)
// and the error name goes to the server log.
// `tokenSessionVersion` is what the session token carries (undefined for a token from before versions existed).
export async function readAccountAccess(tenantId: string, userId: string, tokenSessionVersion?: number): Promise<AccountAccess> {
  try {
    const state = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true, isActive: true, mustChangePassword: true, sessionVersion: true },
    });
    return resolveAccountAccess(state, tokenSessionVersion);
  } catch (error) {
    console.error("[readAccountAccess] Error:", error instanceof Error ? error.name : "unknown");
    return NO_ACCESS;
  }
}
