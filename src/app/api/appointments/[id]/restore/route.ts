// src/app/api/appointments/[id]/restore/route.ts
// Restore a deleted visit (ticket #103, D14 to D16). Owner and staff, permission "appointments.delete".
// Only before the visit's original start time, and never on top of another visit (for every role).
// Body (optional): { appointmentDate } to restore into one of the free times offered when the slot is taken.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { requirePermission } from "@/lib/permission-guard";
import { trailRoleOf } from "@/lib/appointment-admin-rules";
import { restoreAppointment, type RestorableVisit } from "@/lib/appointments-service";
import { buildCalendarText } from "@/lib/appointment-calendar-text";
import { parseBusinessHours, slotWithinHours } from "@/lib/business-hours";
import { dateKeyInClinicZone, hasConnectedCalendar } from "@/lib/calendar-sync";
import { clinicTimeOf } from "@/lib/clinic-time";
import { omitClinicalNotes } from "@/lib/permissions";
import { omitReminderError } from "@/lib/reminder-state";
import { isSyntheticEmail } from "@/lib/patient-intake";
import { slotRefused } from "@/lib/panel-appointments";
import { usableTimeZone } from "@/lib/tenant-time-zone";

const ACTIVE: readonly string[] = ["PENDING", "CONFIRMED"];

const STATUS_BY_REASON = {
  not_found: { code: "appointment_not_found", status: 404 },
  restore_window_closed: { code: "restore_window_closed", status: 400 },
  slot_unavailable: { code: "slot_unavailable", status: 409 },
  outside_business_hours: { code: "outside_business_hours", status: 400 },
  date_in_past: { code: "date_in_past", status: 400 },
} as const;

function parseNewStart(body: unknown): Date | null | "invalid" {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>).appointmentDate : undefined;
  if (value === undefined || value === null || value === "") return null;
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : "invalid";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requirePermission("appointments.delete");
    if (!access.ok) return access.response;
    const { tenantId, session } = access;
    const role = trailRoleOf(access.role);
    if (!role || !session.user.id) return apiError("forbidden", 403);

    const newStart = parseNewStart(await req.json().catch(() => ({})));
    if (newStart === "invalid") return apiError("date_invalid", 400);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessHours: true, timeZone: true, hasPhysicalLocation: true, address: true },
    });
    if (!tenant) return apiError("tenant_not_found", 404);
    const hours = parseBusinessHours(tenant.businessHours);
    const zone = usableTimeZone(tenant.timeZone);

    const result = await restoreAppointment({
      tenantId,
      appointmentId: params.id,
      actor: { userId: session.user.id, role },
      now: new Date(),
      newStart,
      withinHours: (start, minutes) => slotWithinHours(hours, dateKeyInClinicZone(start, zone), clinicTimeOf(start, zone), minutes),
      calendarFor: (visit: RestorableVisit) => ({
        ...buildCalendarText({
          serviceName: visit.product.name,
          customerName: visit.customerName,
          petName: visit.pet?.name ?? null,
          reason: visit.notes,
          fallbackReason: "Cita recuperada desde el panel",
          phone: visit.customerPhone,
          age: visit.customerAge,
          modality: visit.modality,
        }),
        // A placeholder login (patients who gave no email) never gets an invitation.
        attendeeEmail: visit.customerEmail && !isSyntheticEmail(visit.customerEmail) ? visit.customerEmail : "",
        location: tenant.hasPhysicalLocation ? tenant.address : null,
      }),
    });

    if (!result.ok) {
      const { code, status } = STATUS_BY_REASON[result.reason];
      if (result.reason !== "slot_unavailable" && result.reason !== "outside_business_hours") return apiError(code, status);
      // A taken slot is never a bare "no": the nearest free times come back so the visit can be restored there.
      const visit = await prisma.appointment.findFirst({
        where: { id: params.id, tenantId, deletedAt: { not: null } },
        select: { appointmentDate: true, durationMinutes: true },
      });
      if (!visit) return apiError(code, status);
      return slotRefused(code, status, {
        tenantId,
        zone,
        hours,
        durationMinutes: visit.durationMinutes,
        target: newStart ?? visit.appointmentDate,
        now: new Date(),
      });
    }
    // An active visit should have its event back; a connected calendar without it means the calendar step failed.
    const restored = result.appointment;
    const calendarSynced =
      !ACTIVE.includes(restored.status) || Boolean(restored.externalEventId) || !(await hasConnectedCalendar(tenantId));
    return NextResponse.json({ ...omitClinicalNotes(access.role, omitReminderError(restored)), calendarSynced });
  } catch (error) {
    console.error("[POST /api/appointments/[id]/restore] Error:", error);
    return apiError("internal_error", 500);
  }
}
