// src/lib/panel-appointments.ts
// HTTP adapter for visits created, edited and reopened from /admin/citas (ticket #103): the real database and
// calendar calls (PanelDeps) and the NextResponse wrappers. The behavior itself lives in panel-appointments-core.ts
// and is tested there with fakes. tenantId and role always come from the session (the routes pass them in).
import { NextResponse } from "next/server";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiErrorWith, type ApiErrorCode } from "@/lib/api-errors";
import { appointmentInclude, createAppointment } from "@/lib/appointments-service";
import { reopenVisit, replaceCalendarEvent, updateVisit } from "@/lib/appointments-panel-service";
import { hasConnectedCalendar, syncCalendarUpdate } from "@/lib/calendar-sync";
import { nearestFreeSlots, type NearestFreeInput } from "@/lib/free-slots";
import { guestEmailFor } from "@/lib/patient-intake";
import { patientKeyOf } from "@/lib/patient-key";
import { getKnownPatient } from "@/lib/patients";
import {
  createCore,
  editCore,
  reopenCore,
  type PanelDeps,
  type PanelResult,
  type PanelTenant,
  type VisitRow,
} from "@/lib/panel-appointments-core";

export type { PanelTenant } from "@/lib/panel-appointments-core";

const EDIT_KEYS = ["appointmentDate", "productId", "clientName", "clientAge", "clientEmail", "modality", "notes"] as const;

/** A PATCH from the panel that changes the visit itself (not only its status or clinical note). */
export function isPanelEdit(body: Record<string, unknown>): boolean {
  return EDIT_KEYS.some((key) => body[key] !== undefined);
}

export const realPanelDeps: PanelDeps = {
  findProduct: (tenantId, productId, { activeOnly }) =>
    prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null, ...(activeOnly ? { isActive: true } : {}) },
      select: { id: true, name: true, durationMinutes: true, requiresBooking: true, visitModes: true },
    }),
  // One guest account per phone; upsert so two first bookings at once never collide (security review, my #7).
  guestUserId: async (tenantId, phone, name) => {
    const email = guestEmailFor(patientKeyOf(phone) as string);
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: { tenantId, email, name, role: "CUSTOMER" },
      update: {},
      select: { id: true },
    });
    return user.id;
  },
  knownPatientName: async (tenantId, phone) => (await getKnownPatient(tenantId, patientKeyOf(phone)))?.name ?? null,
  createVisit: async (input) => {
    const result = await createAppointment({ ...input, calendar: { ...input.calendar } });
    return result.ok ? { ok: true, appointment: result.appointment } : { ok: false };
  },
  updateVisit: (tenantId, visit, changes, checkConflicts) => updateVisit(tenantId, visit, changes, checkConflicts),
  reopenVisit: (tenantId, visit, toStatus, now) => reopenVisit(tenantId, visit, toStatus, now),
  hasCalendar: hasConnectedCalendar,
  updateEvent: (tenantId, visit, range, text) => syncCalendarUpdate(tenantId, visit, range, text),
  replaceEvent: (tenantId, visit, event) => replaceCalendarEvent(tenantId, visit, event),
  reloadVisit: (tenantId, id) =>
    prisma.appointment.findFirst({ where: { id, tenantId, deletedAt: null }, include: appointmentInclude }),
  freeSlots: (input) => nearestFreeSlots(input),
  petName: async (petId) => (await prisma.pet.findUnique({ where: { id: petId }, select: { name: true } }))?.name ?? null,
  editTenant: (tenantId) =>
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        vertical: true,
        isBookingEnabled: true,
        businessHours: true,
        serviceModes: true,
        hasPhysicalLocation: true,
        address: true,
      },
    }),
};

function toResponse(result: PanelResult): NextResponse {
  return NextResponse.json(result.body, { status: result.status });
}

/** A taken or out-of-hours time always comes back with the nearest free times (D10). Used by the restore route. */
export async function slotRefused(code: ApiErrorCode, status: number, ctx: NearestFreeInput): Promise<NextResponse> {
  return apiErrorWith(code, status, { alternatives: await nearestFreeSlots(ctx) });
}

export async function createFromPanel(input: { role: string; tenant: PanelTenant; body: unknown; now: Date }): Promise<NextResponse> {
  return toResponse(await createCore(input, realPanelDeps));
}

export async function editFromPanel(input: {
  role: string;
  tenantId: string;
  appointment: VisitRow;
  body: unknown;
  now: Date;
}): Promise<NextResponse> {
  return toResponse(await editCore(input, realPanelDeps));
}

export type ReopenResult =
  | { ok: true; written: boolean; calendarSynced: boolean }
  | { ok: false; response: NextResponse };

/** Reopen rule (owner decision of 2026-11-14): see reopenCore. `written` means the status is already stored. */
export async function reopenFromPanel(input: {
  tenantId: string;
  appointment: VisitRow;
  toStatus: AppointmentStatus;
  now: Date;
}): Promise<ReopenResult> {
  const outcome = await reopenCore(input, realPanelDeps);
  if (!outcome.ok) return { ok: false, response: toResponse(outcome.result) };
  return { ok: true, written: outcome.appointment !== null, calendarSynced: outcome.calendarSynced };
}
