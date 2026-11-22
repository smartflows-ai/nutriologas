// src/lib/team-numbers-data.ts
// The WhatsApp numbers of the people of one business: its own number and the active staff's. The bot never answers
// them as customers (bot/contact-status, bot/media). Every query is limited by tenantId. The comparison is the pure
// isTeamNumber in team-numbers.ts.
import { prisma } from "@/lib/db";

export async function loadTeamNumbers(tenantId: string): Promise<(string | null)[]> {
  const [tenant, staff] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { whatsappNumber: true } }),
    prisma.user.findMany({
      where: { tenantId, role: "STAFF", isActive: true, whatsappNumber: { not: null } },
      select: { whatsappNumber: true },
    }),
  ]);
  return [tenant?.whatsappNumber ?? null, ...staff.map((user) => user.whatsappNumber)];
}
