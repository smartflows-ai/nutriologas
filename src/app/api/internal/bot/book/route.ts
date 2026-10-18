// src/app/api/internal/bot/book/route.ts
// POST: Book an appointment for the WhatsApp customer. Creates the Appointment row first,
// then mirrors it to the tenant's Google Calendar when connected.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createCalendarEvent } from "@/lib/google-calendar";
import {
  buildSlot,
  formatSlotTime,
  getBusyPeriods,
  getTenantAccessToken,
  isInternalKeyValid,
  isSlotFree,
  resolveBotTenant,
} from "@/lib/bot";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { instance, productId, date, time, customerName, customerPhone, customerEmail, notes } = body;

  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  if (!productId || !date || !time || !customerName || !customerPhone) {
    return Response.json(
      { success: false, error: "Faltan datos: productId, date, time, customerName, customerPhone" },
      { status: 400 }
    );
  }
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return Response.json({ success: false, error: "Formato de email inválido" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId: bot.tenantId, isActive: true, deletedAt: null },
    select: { id: true, name: true, durationMinutes: true },
  });
  if (!product) return Response.json({ success: false, error: "Servicio no encontrado" }, { status: 404 });

  const duration = product.durationMinutes ?? 30;
  const slot = buildSlot(date, time, duration);
  if (!slot) {
    return Response.json(
      { success: false, error: "Fecha u hora fuera del horario de atención" },
      { status: 400 }
    );
  }
  if (slot.start.getTime() <= Date.now()) {
    return Response.json({ success: false, error: "La fecha y hora ya pasaron" }, { status: 400 });
  }

  const accessToken = await getTenantAccessToken(bot.tenantId);
  const busy = await getBusyPeriods(bot.tenantId, date, accessToken);
  if (!isSlotFree(busy, slot.start, slot.end)) {
    return Response.json(
      { success: false, error: "slot_unavailable", message: "Ese horario ya no está disponible." },
      { status: 409 }
    );
  }

  // Guest account per phone number, same pattern as the web booking flow.
  const email = customerEmail?.toLowerCase().trim() || `wa_${customerPhone}@booking.local`;
  let user = await prisma.user.findFirst({ where: { tenantId: bot.tenantId, email } });
  if (!user) {
    user = await prisma.user.create({
      data: { tenantId: bot.tenantId, email, name: customerName, role: "CUSTOMER" },
    });
  }

  const appointment = await prisma.appointment.create({
    data: {
      tenantId: bot.tenantId,
      userId: user.id,
      productId: product.id,
      customerName,
      customerPhone,
      appointmentDate: slot.start,
      durationMinutes: duration,
      notes: notes?.trim() || null,
      status: "CONFIRMED",
    },
  });

  let meetLink: string | null = null;
  if (accessToken) {
    try {
      const gEvent = await createCalendarEvent(accessToken, {
        summary: `Cita: ${product.name} - ${customerName}`,
        description: `${notes?.trim() || "Cita agendada por WhatsApp"}\nTel: ${customerPhone}`,
        startDateTime: slot.start.toISOString(),
        endDateTime: slot.end.toISOString(),
        attendeeEmail: customerEmail || "",
      });
      meetLink = gEvent.hangoutLink ?? null;
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { googleEventId: gEvent.id },
      });
    } catch (err) {
      // The appointment is saved; a missing calendar mirror should not fail the booking.
      console.error("[bot/book] Google Calendar sync failed:", err);
    }
  }

  return Response.json(
    {
      success: true,
      appointmentId: appointment.id,
      serviceName: product.name,
      date,
      time: formatSlotTime(slot.start),
      durationMinutes: duration,
      meetLink,
    },
    { status: 201 }
  );
}
