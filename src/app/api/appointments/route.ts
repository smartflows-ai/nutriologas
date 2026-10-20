// src/app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";

import { getAppToken, getConnectedProvider } from "@/lib/connected-apps";
import { createCalendarEvent } from "@/lib/google-calendar";

import { fetchExternalAppointments } from "@/lib/external-calendar";

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

    // Si es administrador, combinar con citas sincronizadas de Google / Microsoft Calendar
    if (isAdmin) {
      let externalAppointments: any[] = [];
      try {
        externalAppointments = await fetchExternalAppointments(tenantId);
      } catch (extErr) {
        console.warn("[GET /api/appointments] Error fetching external calendar:", extErr);
      }

      let filteredExternal = externalAppointments;
      if (status && status !== "ALL") {
        filteredExternal = filteredExternal.filter((a) => a.status === status);
      }

      if (dateStr) {
        filteredExternal = filteredExternal.filter((a) => {
          const dIso = a.appointmentDate.slice(0, 10);
          const dLocal = new Date(a.appointmentDate).toLocaleDateString("en-CA");
          return dIso === dateStr || dLocal === dateStr;
        });
      }

      let combined = [...formattedNative, ...filteredExternal];

      if (dateStr) {
        combined = combined.filter((a) => {
          const dIso = a.appointmentDate.slice(0, 10);
          const dLocal = new Date(a.appointmentDate).toLocaleDateString("en-CA");
          return dIso === dateStr || dLocal === dateStr;
        });
      }

      combined.sort(
        (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
      );

      return NextResponse.json(combined.slice(0, limit));
    }

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
    let userId: string | null = session?.user?.id ?? null;

    const host = req.headers.get("host") || "";
    const tenantSlug = resolveTenantSlug(host);
    const tenant = await prisma.tenant.findFirst({
      where: tenantId 
        ? { id: tenantId } 
        : { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
      select: { id: true, name: true, whatsappNumber: true },
    });

    if (!tenant) return apiError("tenant_not_found", 404);
    tenantId = tenant.id;

    const body = await req.json();
    const { productId, appointmentDate, notes, clientName, clientEmail, clientPhone } = body;

    if (!productId || !appointmentDate) {
      return apiError("service_and_date_required", 400);
    }

    // Verificar que el producto exista y pertenezca al tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });

    if (!product) {
      return apiError("product_not_found", 404);
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

    // Prefijar notas con teléfono para máxima redundancia y compatibilidad
    const enrichedNotes = [
      notes?.trim() || null,
      clientPhone ? `Tel: ${clientPhone}` : null,
      clientName ? `Paciente: ${clientName}` : null,
    ].filter(Boolean).join(" | ");

    let appointment;
    try {
      appointment = await prisma.appointment.create({
        data: {
          tenantId,
          userId,
          productId,
          customerName: clientName || null,
          customerPhone: clientPhone || null,
          appointmentDate: apptDate,
          durationMinutes: duration,
          notes: enrichedNotes || null,
          status: "PENDING",
        },
        include: {
          product: { select: { name: true, durationMinutes: true, price: true } },
          user: { select: { name: true, email: true } },
        },
      });
    } catch (createErr: any) {
      console.warn("[POST /api/appointments] Fallback create without direct customer columns:", createErr.message);
      appointment = await prisma.appointment.create({
        data: {
          tenantId,
          userId,
          productId,
          appointmentDate: apptDate,
          durationMinutes: duration,
          notes: enrichedNotes || null,
          status: "PENDING",
        },
        include: {
          product: { select: { name: true, durationMinutes: true, price: true } },
          user: { select: { name: true, email: true } },
        },
      });
    }

    // --- INTEGRACIÓN GOOGLE CALENDAR ---
    try {
      const provider = await getConnectedProvider(tenantId, ["GOOGLE"]);
      if (provider === "GOOGLE") {
        const accessToken = await getAppToken(tenantId, "GOOGLE");
        if (accessToken) {
          const endApptDate = new Date(apptDate.getTime() + duration * 60000);
          
          const gEvent = await createCalendarEvent(accessToken, {
            summary: `Cita: ${appointment.product.name} - ${clientName || "Paciente"}`,
            description: enrichedNotes || "Cita agendada vía web",
            startDateTime: apptDate.toISOString(),
            endDateTime: endApptDate.toISOString(),
            attendeeEmail: clientEmail || "",
          });

          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { googleEventId: gEvent.id },
          });
        }
      }
    } catch (gErr: any) {
      console.error("[POST /api/appointments] Google Calendar sync error:", gErr);
    }

    return NextResponse.json(appointment, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/appointments] Error:", error);
    return apiError("internal_error", 500);
  }
}
