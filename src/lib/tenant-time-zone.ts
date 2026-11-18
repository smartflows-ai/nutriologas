// src/lib/tenant-time-zone.ts
// Server only: the time zone of a business (Tenant.timeZone), for code that only has the tenant id (booking, busy
// times, calendar). Pure clock rules live in src/lib/clinic-time.ts; this file only reads the setting.
import { prisma } from "@/lib/db";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/clinic-time";

/** A stored zone when it is a real IANA name; the default otherwise, so a bad value never breaks booking. */
export function usableTimeZone(zone: string | null | undefined): string {
  return isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

/** The business's zone ("America/Cancun"). One primary-key read. */
export async function getTenantTimeZone(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timeZone: true } });
  return usableTimeZone(tenant?.timeZone);
}
