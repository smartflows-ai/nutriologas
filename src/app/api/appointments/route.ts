// src/app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";

import { createAppointment } from "@/lib/appointments-service";
import { dateKeyInClinicZone, linkedEventKeys } from "@/lib/calendar-sync";
import { clinicTimeOf } from "@/lib/clinic-time";
import { patientKeyOf } from "@/lib/patient-key";
import { parseBusinessHours, slotWithinHours } from "@/lib/business-hours";
import { isBookable } from "@/lib/bookable";
import { dropLinkedExternal, fetchExternalAppointments } from "@/lib/external-calendar";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Admin agenda: one month of native and external (Google / Microsoft) appointments.
 * Status, search and day filters run on the server. Counts and day markers cover the whole month,
 * so the calendar and the KPI cards do not change when a filter is applied.
 * Query: month=YYYY-MM, day=YYYY-MM-DD, status=ALL|PENDING|CONFIRMED|COMPLETED|CANCELLED, q, page, pageSize.
 */
async function getAdminAgenda(req: NextRequest, tenantId: string) {
  const sp = new URL(req.url).searchParams;
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthParam = sp.get("month") ?? "";
  const month = MONTH_RE.test(monthParam) ? monthParam : defaultMonth;
  const dayParam = sp.get("day") ?? "";
  const day = DAY_RE.test(dayParam) ? dayParam : "";
  const status = sp.get("status") || "ALL";
  const q = (sp.get("q") || "").trim().toLowerCase();
  const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20") || 20));

  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));

  const nativeAppointments = await prisma.appointment.findMany({
    where: { tenantId, appointmentDate: { gte: start, lte: end } },
    include: {
      product: {
        select: { id: true, name: true, price: true, durationMinutes: true, images: true, category: true },
      },
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { appointmentDate: "asc" },
  });

  const formattedNative = nativeAppointments.map((a) => ({
    ...a,
    source: "native" as const,
    customerName: a.customerName || a.user?.name || "Paciente",
    customerPhone: a.customerPhone || null,
    customerEmail: a.customerEmail || a.user?.email || null,
    appointmentDate: a.appointmentDate.toISOString(),
    createdAt: a.createdAt.toISOString(),
  }));

  // Calendar events that mirror a native booking are already listed as native rows; skip them here.
  let externalAppointments: any[] = [];
  try {
    const fetched = await fetchExternalAppointments(tenantId, start.toISOString(), end.toISOString());
    externalAppointments = dropLinkedExternal(fetched, linkedEventKeys(nativeAppointments));
  } catch (extErr) {
    console.warn("[GET /api/appointments] Error fetching external calendar:", extErr);
  }

  const all: any[] = [...formattedNative, ...externalAppointments].sort(
    (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
  );

  const counts: Record<string, number> = { ALL: all.length, PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0, NO_SHOW: 0 };
  for (const a of all) counts[a.status] = (counts[a.status] ?? 0) + 1;

  const days = Array.from(new Set(all.map((a) => String(a.appointmentDate).slice(0, 10))));

  const matchesStatus = (s: string) =>
    status === "ALL" || (status === "CANCELLED" ? s === "CANCELLED" || s === "NO_SHOW" : s === status);

  const matchesSearch = (a: any) =>
    !q ||
    [a.customerName, a.user?.name, a.customerPhone, a.product?.name, a.notes].some((v) =>
      String(v ?? "").toLowerCase().includes(q)
    );

  const filtered = all.filter(
    (a) =>
      (!day || String(a.appointmentDate).slice(0, 10) === day) &&
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
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let tenantId: string | null = (session?.user as any)?.tenantId ?? null;
    let userId: string | null = session?.user?.id ?? null;
    const isAdmin = (session?.user as any)?.role === "ADMIN";

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
    if (isAdmin) return getAdminAgenda(req, tenantId);

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
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
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

    const formattedNative = nativeAppointments.map((a) => ({
      ...a,
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
    // A logged-in customer owns the booking. An admin session books for the customer typed in the form,
    // so the booking goes to a guest account from that email and never lands under the admin account.
    const isAdminSession = (session?.user as any)?.role === "ADMIN";
    let userId: string | null = isAdminSession ? null : session?.user?.id ?? null;

    const host = req.headers.get("host") || "";
    const tenantSlug = resolveTenantSlug(host);
    const tenant = await prisma.tenant.findFirst({
      where: tenantId
        ? { id: tenantId } 
        : { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
      select: { id: true, name: true, whatsappNumber: true, isBookingEnabled: true, businessHours: true },
    });

    if (!tenant) return apiError("tenant_not_found", 404);
    tenantId = tenant.id;

    const body = await req.json();
    const { productId, appointmentDate, notes, clientName, clientEmail, clientPhone } = body;

    if (!productId || !appointmentDate) {
      return apiError("service_and_date_required", 400);
    }
    // The phone is the patient's identity (visit history), so every booking needs a usable one.
    if (!patientKeyOf(clientPhone)) {
      return apiError("phone_required", 400);
    }

    // Verificar que el producto exista y pertenezca al tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });

    if (!product) {
      return apiError("product_not_found", 404);
    }

    // Public bookings only: the item must be sold by appointment and the time must be inside business hours.
    // Admin-created appointments are not restricted.
    if (!isAdminSession && !isBookable(product, tenant)) {
      return apiError("not_bookable", 400);
    }

    // Resolver usuario: si está logueado usar su cuenta, sino crear o buscar usuario cliente
    if (!userId) {
      const email = clientEmail?.toLowerCase()?.trim() || `anon_${Date.now()}@booking.local`;
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

    const duration = product.durationMinutes || 30;

    if (!isAdminSession) {
      const hours = parseBusinessHours(tenant.businessHours);
      const day = dateKeyInClinicZone(apptDate);
      if (!slotWithinHours(hours, day, clinicTimeOf(apptDate), duration)) {
        return apiError("outside_business_hours", 400);
      }
    }

    // Notes hold only the patient's reason. Name and phone live in their own columns.
    const reason = notes?.trim() || null;
    const calendarDescription = [
      reason ?? "Cita agendada vía web",
      clientPhone ? `Tel: ${clientPhone}` : null,
      clientName ? `Paciente: ${clientName}` : null,
    ].filter(Boolean).join("\n");

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
      notes: reason,
      calendar: {
        summary: `Cita: ${product.name} - ${clientName || "Paciente"}`,
        description: calendarDescription,
        attendeeEmail: clientEmail || "",
      },
    });
    if (!result.ok) return apiError("slot_unavailable", 409);

    return NextResponse.json(result.appointment, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/appointments] Error:", error);
    return apiError("internal_error", 500);
  }
}
