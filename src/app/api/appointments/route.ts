// src/app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getVerticalProfile } from "@/lib/vertical-profile";
import { cleanPetName } from "@/lib/pets";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";

import { createAppointment } from "@/lib/appointments-service";
import { createFromPanel } from "@/lib/panel-appointments";
import { rateLimited } from "@/lib/rate-limit";
import { dateKeyInClinicZone, linkedEventKeys } from "@/lib/calendar-sync";
import { clinicDateKeyOf, clinicDateTime, clinicTimeOf } from "@/lib/clinic-time";
import { patientKeyOf } from "@/lib/patient-key";
import { checkWebVisitLimit } from "@/lib/booking-limit-data";
import { parseBusinessHours, slotWithinHours } from "@/lib/business-hours";
import { isBookable } from "@/lib/bookable";
import { dropLinkedExternal, fetchExternalAppointments } from "@/lib/external-calendar";
import { omitReminderError } from "@/lib/reminder-state";
import { optedOutKeysOf, whatsappPermissionOf } from "@/lib/whatsapp-permission";
import { can, omitClinicalNotes } from "@/lib/permissions";
import { buildCalendarText } from "@/lib/appointment-calendar-text";
import { guestEmailFor, parseAge, resolveModality } from "@/lib/patient-intake";
import { isPlausibleFullName } from "@/lib/full-name";
import { getTenantTimeZone, usableTimeZone } from "@/lib/tenant-time-zone";

const MONTH_RE = /^\d{4}-\d{2}$/;
// Panel bookings per user per minute (security review S5): plenty for a front desk, a stop for a runaway loop.
const PANEL_BOOKINGS_PER_MINUTE = 30;
const MINUTE_MS = 60_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Admin agenda: one month of native and external (Google / Microsoft) appointments.
 * Status, search and day filters run on the server. Day markers always cover the whole month, so the calendar
 * keeps its dots. Counts (status tabs and KPI cards) cover the chosen day, or the whole month when no day is chosen;
 * they ignore the status and search filters.
 * Query: month=YYYY-MM, day=YYYY-MM-DD, status=ALL|PENDING|CONFIRMED|COMPLETED|CANCELLED|DELETED, q, page, pageSize.
 * DELETED (roles with "appointments.delete") lists the month's deleted visits with their delete / restore trail;
 * deleted visits never appear in the other tabs, the counts of those tabs or the calendar dots (ticket #103).
 */
async function getAdminAgenda(req: NextRequest, tenantId: string, role: string) {
  const sp = new URL(req.url).searchParams;
  const now = new Date();
  // Months and days are the business's own (Tenant.timeZone, ticket #111): a visit at 19:30 in Mexico City is on its
  // own day, never on the next UTC day.
  const zone = await getTenantTimeZone(tenantId);
  const dayOf = (iso: string) => clinicDateKeyOf(new Date(iso), zone);
  const defaultMonth = clinicDateKeyOf(now, zone).slice(0, 7);
  const monthParam = sp.get("month") ?? "";
  const month = MONTH_RE.test(monthParam) ? monthParam : defaultMonth;
  const dayParam = sp.get("day") ?? "";
  const day = DAY_RE.test(dayParam) ? dayParam : "";
  const status = sp.get("status") || "ALL";
  const q = (sp.get("q") || "").trim().toLowerCase();
  const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20") || 20));

  const [year, monthIndex] = month.split("-").map(Number);
  const nextMonth = monthIndex === 12 ? `${year + 1}-01` : `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const start = new Date(clinicDateTime(`${month}-01`, "00:00", zone));
  const end = new Date(new Date(clinicDateTime(`${nextMonth}-01`, "00:00", zone)).getTime() - 1);

  const include = {
    product: {
      select: { id: true, name: true, price: true, priceMode: true, durationMinutes: true, images: true, category: true },
    },
    user: { select: { id: true, name: true, email: true, image: true } },
    pet: { select: { name: true } },
  } as const;
  // "Eliminadas" (ticket #103): deleted visits of the month, with who deleted or restored them and when.
  const canSeeDeleted = can(role, "appointments.delete");
  const [nativeAppointments, deletedAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId, deletedAt: null, appointmentDate: { gte: start, lte: end } },
      include,
      orderBy: { appointmentDate: "asc" },
    }),
    canSeeDeleted
      ? prisma.appointment.findMany({
          where: { tenantId, deletedAt: { not: null }, appointmentDate: { gte: start, lte: end } },
          include: {
            ...include,
            trail: { orderBy: { at: "asc" }, select: { action: true, at: true, user: { select: { name: true } } } },
          },
          orderBy: { appointmentDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Holes 4 and 5: the patients who asked not to receive WhatsApp messages, for the permission badge.
  const optedOutChats = await prisma.whatsAppChat.findMany({ where: { tenantId, optedOutAt: { not: null } }, select: { remoteJid: true } });
  const optedOutKeys = optedOutKeysOf(optedOutChats.map((c) => c.remoteJid));

  // Clinical notes only reach roles with "appointments.notes" (STAFF sees the agenda without them).
  const format = (a: (typeof nativeAppointments)[number]) => ({
    ...omitClinicalNotes(role, omitReminderError(a)),
    source: "native" as const,
    whatsappPermission: whatsappPermissionOf(a, patientKeyOf(a.customerPhone), optedOutKeys),
    customerName: a.customerName || a.user?.name || "Paciente",
    customerPhone: a.customerPhone || null,
    customerEmail: a.customerEmail || a.user?.email || null,
    appointmentDate: a.appointmentDate.toISOString(),
    createdAt: a.createdAt.toISOString(),
  });
  const formattedNative = nativeAppointments.map(format);
  const formattedDeleted = deletedAppointments.map(({ trail, ...a }) => ({
    ...format(a),
    deletedAt: a.deletedAt?.toISOString() ?? null,
    trail: trail.map((t) => ({ action: t.action, at: t.at.toISOString(), by: t.user?.name ?? null })),
  }));

  // Calendar events that mirror a native booking are already listed as native rows; skip them here.
  let externalAppointments: any[] = [];
  try {
    const fetched = await fetchExternalAppointments(tenantId, start.toISOString(), end.toISOString());
    // External events reuse internalNotes for the event location; same rule as native rows.
    externalAppointments = dropLinkedExternal(fetched, linkedEventKeys(nativeAppointments)).map((e) =>
      omitClinicalNotes(role, e),
    );
  } catch (extErr) {
    console.warn("[GET /api/appointments] Error fetching external calendar:", extErr);
  }

  const all: any[] = [...formattedNative, ...externalAppointments].sort(
    (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
  );

  // Counts follow the day filter (the whole month when no day is chosen), but not status or search,
  // so every status tab shows how many visits it would list for that day.
  const inScope = day ? all.filter((a) => dayOf(String(a.appointmentDate)) === day) : all;
  const counts: Record<string, number> = { ALL: inScope.length, PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0, NO_SHOW: 0 };
  for (const a of inScope) counts[a.status] = (counts[a.status] ?? 0) + 1;
  // Deleted visits have their own tab: they never count in "Todas", the KPIs or the calendar dots.
  if (canSeeDeleted) {
    counts.DELETED = formattedDeleted.filter((a) => !day || dayOf(a.appointmentDate) === day).length;
  }

  const days = Array.from(new Set(all.map((a) => dayOf(String(a.appointmentDate)))));

  const showDeleted = status === "DELETED" && canSeeDeleted;
  const matchesStatus = (s: string) =>
    showDeleted || status === "ALL" || (status === "CANCELLED" ? s === "CANCELLED" || s === "NO_SHOW" : s === status);

  const matchesSearch = (a: any) =>
    !q ||
    [a.customerName, a.user?.name, a.customerPhone, a.product?.name, a.notes].some((v) =>
      String(v ?? "").toLowerCase().includes(q)
    );

  const source: any[] = showDeleted ? formattedDeleted : all;
  const filtered = source.filter(
    (a) =>
      (!day || dayOf(String(a.appointmentDate)) === day) &&
      matchesStatus(a.status) &&
      matchesSearch(a)
  );

  return NextResponse.json({
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    counts,
    days,
    timeZone: zone,
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let tenantId: string | null = (session?.user as any)?.tenantId ?? null;
    let userId: string | null = session?.user?.id ?? null;
    const role: string = session?.user?.role ?? "";
    // ADMIN and STAFF get the business agenda; anyone else only their own appointments.
    const isAdmin = can(role, "appointments.view");

    if (!tenantId) {
      const host = req.headers.get("host") || "";
      const tenantSlug = resolveTenantSlug(host);
      const tenant = await prisma.tenant.findFirst({
        where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
        select: { id: true },
      });
      if (!tenant) return apiError("tenant_not_found", 404);
      tenantId = tenant.id;
    }

    // Admin agenda is paginated by month (see getAdminAgenda).
    if (isAdmin) return getAdminAgenda(req, tenantId, role);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: any = { tenantId };

    // Si no es admin, solo puede ver sus propias citas
    if (!isAdmin) {
      if (!userId) {
        return apiError("unauthorized", 401);
      }
      where.userId = userId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (dateStr) {
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
      where.appointmentDate = {
        gte: new Date(startOfDay.getTime() - 86400000), // margen de zona horaria
        lte: new Date(endOfDay.getTime() + 86400000),
      };
    }

    const nativeAppointments = await prisma.appointment.findMany({
      where: { ...where, deletedAt: null },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true, priceMode: true,
            durationMinutes: true,
            images: true,
            category: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { appointmentDate: "asc" },
      take: limit,
    });

    // A customer never receives the clinical notes written about their own visit.
    const formattedNative = nativeAppointments.map((a) => ({
      ...omitClinicalNotes(role, omitReminderError(a)),
      source: "native" as const,
      customerName: a.customerName || a.user?.name || "Paciente",
      customerPhone: a.customerPhone || null,
      appointmentDate: a.appointmentDate.toISOString(),
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json(formattedNative);
  } catch (error: any) {
    console.error("[GET /api/appointments] Error:", error);
    return apiError("internal_error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let tenantId: string | null = (session?.user as any)?.tenantId ?? null;
    // An ADMIN or STAFF session books from /admin/citas for the patient typed in the form: its own rules live in
    // src/lib/panel-appointments.ts (ticket #103). Everything below is the public booking (web storefront).
    const isPanelSession = can(session?.user?.role, "appointments.book");
    // A logged-in customer owns the booking; a guest gets an account from the email or the phone.
    let userId: string | null = isPanelSession ? null : session?.user?.id ?? null;

    const host = req.headers.get("host") || "";
    const tenantSlug = resolveTenantSlug(host);
    const tenant = await prisma.tenant.findFirst({
      where: tenantId
        ? { id: tenantId } 
        : { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
      select: {
        id: true,
        name: true,
        whatsappNumber: true,
        vertical: true,
        isBookingEnabled: true,
        businessHours: true,
        timeZone: true,
        serviceModes: true,
        hasPhysicalLocation: true,
        address: true,
      },
    });

    if (!tenant) return apiError("tenant_not_found", 404);
    tenantId = tenant.id;

    const body = await req.json();
    if (isPanelSession) {
      // Each refused time reads the calendar for the nearest free ones; a runaway loop must not burn that quota.
      if (rateLimited(`panel-book:${tenant.id}:${session?.user?.id}`, PANEL_BOOKINGS_PER_MINUTE, MINUTE_MS)) {
        return apiError("too_many_attempts", 429);
      }
      return createFromPanel({ role: session?.user?.role ?? "", tenant, body, now: new Date() });
    }
    const { productId, appointmentDate, notes, clientName, clientEmail, clientPhone, clientAge, modality: requestedModality, petName, petSpecies, whatsappConsent } = body;

    if (!productId || !appointmentDate) {
      return apiError("service_and_date_required", 400);
    }
    // The phone is the patient's identity (visit history), so every booking needs a usable one.
    if (!patientKeyOf(clientPhone)) {
      return apiError("phone_required", 400);
    }
    // First name and surname on every visit (ticket #113).
    if (!isPlausibleFullName(clientName)) {
      return apiError("full_name_required", 400);
    }
    // Age is part of the patient record.
    const age = parseAge(clientAge);
    if (age === null) {
      return apiError("age_required", 400);
    }
    // Veterinary and pet-care businesses book per pet, so the history follows the animal.
    const { usesPets } = getVerticalProfile(tenant.vertical, tenant.isBookingEnabled);
    const pet = usesPets ? cleanPetName(petName) : "";
    if (usesPets && !pet) {
      return apiError("pet_required", 400);
    }

    // Verificar que el producto exista y pertenezca al tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });

    if (!product) {
      return apiError("product_not_found", 404);
    }

    // In person or online: the service decides (its own setting, or the business default). When both are possible
    // the patient must choose. A mode the service does not offer is refused.
    const resolvedModality = resolveModality(tenant.serviceModes, requestedModality, product.visitModes);
    if (!resolvedModality.ok) {
      return apiError(resolvedModality.error, 400);
    }
    const modality = resolvedModality.modality;

    // The item must be sold by appointment and the time must be inside business hours.
    if (!isBookable(product, tenant)) {
      return apiError("not_bookable", 400);
    }

    // Visit limit (ticket #141): at most 3 active future visits per person, counted by the phone of the visit and, with a
    // customer session, by their account. Before any account or visit is created. No chat on the web: nothing is paused.
    const limit = await checkWebVisitLimit({
      tenantId,
      patientKey: patientKeyOf(clientPhone) as string,
      userId,
      now: new Date(),
    });
    if (!limit.allowed) return apiError("visit_limit_reached", 409);

    // Resolver usuario: si está logueado usar su cuenta, sino crear o buscar usuario cliente
    if (!userId) {
      // No email: a stable placeholder per phone number, so repeat visits reuse one guest account.
      const email = clientEmail?.toLowerCase()?.trim() || guestEmailFor(patientKeyOf(clientPhone) as string);
      let user = await prisma.user.findFirst({
        where: { tenantId, email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            tenantId,
            email,
            name: clientName || "Paciente / Cliente",
            role: "CUSTOMER",
          },
        });
      } else if (clientName && (!user.name || user.name === "Paciente / Cliente")) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: clientName },
        });
      }
      userId = user.id;
    }

    const apptDate = new Date(appointmentDate);
    if (isNaN(apptDate.getTime())) {
      return apiError("date_invalid", 400);
    }

    if (apptDate.getTime() <= Date.now()) {
      return apiError("date_in_past", 400);
    }

    const duration = product.durationMinutes || 30;

    const hours = parseBusinessHours(tenant.businessHours);
    const zone = usableTimeZone(tenant.timeZone);
    const day = dateKeyInClinicZone(apptDate, zone);
    if (!slotWithinHours(hours, day, clinicTimeOf(apptDate, zone), duration)) {
      return apiError("outside_business_hours", 400);
    }

    // Notes hold only the patient's reason. Name and phone live in their own columns.
    const reason = notes?.trim() || null;
    const calendarText = buildCalendarText({
      serviceName: product.name,
      customerName: clientName || null,
      petName: pet || null,
      reason,
      fallbackReason: "Cita agendada vía web",
      phone: clientPhone || null,
      age,
      modality,
    });

    const result = await createAppointment({
      tenantId,
      userId,
      productId,
      appointmentDate: apptDate,
      durationMinutes: duration,
      status: "PENDING",
      customerName: clientName || null,
      customerPhone: clientPhone || null,
      customerEmail: clientEmail?.toLowerCase().trim() || null,
      customerAge: age,
      modality,
      bookingChannel: "WEB",
      // The customer ticked the WhatsApp reminders box on /agendar. Unticked = no consent (never assumed).
      whatsappConsentAt: whatsappConsent === true ? new Date() : null,
      whatsappConsentSource: whatsappConsent === true ? "WEB_CHECKBOX" : null,
      notes: reason,
      petName: pet || null,
      petSpecies: usesPets ? petSpecies ?? null : null,
      calendar: {
        summary: calendarText.summary,
        description: calendarText.description,
        // No email means no invitation: the event only lands on the doctor's calendar.
        attendeeEmail: clientEmail || "",
        location: tenant.hasPhysicalLocation ? tenant.address : null,
      },
    });
    if (!result.ok) return apiError("slot_unavailable", 409);

    return NextResponse.json(result.appointment, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/appointments] Error:", error);
    return apiError("internal_error", 500);
  }
}
