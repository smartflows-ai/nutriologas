// src/lib/time-zone-change-data.ts
// Server reads for ticket #127: the future active visits of one business and how they read on another zone.
// The rule itself is pure (src/lib/time-zone-change.ts); this file only loads the rows. Server only.
import { prisma } from "@/lib/db";
import { parseBusinessHours } from "@/lib/business-hours";
import { usableTimeZone } from "@/lib/tenant-time-zone";
import { zoneShiftImpact, type ShiftedVisit } from "@/lib/time-zone-change";

export interface ZoneShift {
  fromZone: string;
  toZone: string;
  visits: ShiftedVisit[];
}

/** Future PENDING or CONFIRMED visits of the business whose day or hour changes on `toZone`. */
export async function loadZoneShift(tenantId: string, toZone: string, now: Date = new Date()): Promise<ZoneShift> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timeZone: true, businessHours: true },
  });
  const fromZone = usableTimeZone(tenant?.timeZone);
  if (fromZone === toZone) return { fromZone, toZone, visits: [] };

  const rows = await prisma.appointment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ["PENDING", "CONFIRMED"] },
      appointmentDate: { gt: now },
    },
    select: { id: true, appointmentDate: true, customerName: true, product: { select: { name: true } } },
    orderBy: { appointmentDate: "asc" },
  });
  const visits = zoneShiftImpact(
    rows.map((row) => ({
      id: row.id,
      appointmentDate: row.appointmentDate,
      customerName: row.customerName,
      productName: row.product.name,
    })),
    fromZone,
    toZone,
    parseBusinessHours(tenant?.businessHours),
  );
  return { fromZone, toZone, visits };
}
