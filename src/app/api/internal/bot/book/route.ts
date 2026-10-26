// src/app/api/internal/bot/book/route.ts
// POST: Book an appointment for the WhatsApp customer. Creates the Appointment row first,
// then mirrors it to the tenant's Google Calendar when connected.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createAppointment } from "@/lib/appointments-service";
import { buildSlot, formatSlotTime, isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { isBookable } from "@/lib/bookable";
import { cleanPetName } from "@/lib/pets";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { instance, productId, date, time, customerName, customerPhone, customerEmail, notes, petName, petSpecies } = body;

  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  if (!productId || !date || !time || !customerName || !customerPhone) {
    return Response.json(
      { success: false, error: "Faltan datos: productId, date, time, customerName, customerPhone" },
      { status: 400 }
    );
  }
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return Response.json(
      { success: false, error: "email_required", message: "Pide al cliente un correo electrónico válido para enviarle la invitación." },
      { status: 400 }
    );
  }

  // Veterinary and pet-care businesses book per pet, so the history follows the animal.
  const pet = bot.usesPets ? cleanPetName(petName) : "";
  if (bot.usesPets && !pet) {
    return Response.json(
      { success: false, error: "pet_required", message: "Pide el nombre de la mascota antes de agendar." },
      { status: 400 }
    );
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId: bot.tenantId, isActive: true, deletedAt: null },
    select: { id: true, name: true, durationMinutes: true, requiresBooking: true },
  });
  if (!product) return Response.json({ success: false, error: "Servicio no encontrado" }, { status: 404 });
  if (!isBookable(product, bot)) {
    return Response.json(
      { success: false, error: "not_bookable", message: "Este artículo no se agenda con cita." },
      { status: 400 }
    );
  }

  const duration = product.durationMinutes ?? 30;
  const slot = buildSlot(date, time, duration, bot.businessHours);
  if (!slot) {
    return Response.json(
      { success: false, error: "Fecha u hora fuera del horario de atención" },
      { status: 400 }
    );
  }
  if (slot.start.getTime() <= Date.now()) {
    return Response.json({ success: false, error: "La fecha y hora ya pasaron" }, { status: 400 });
  }

  // Guest account per phone number, same pattern as the web booking flow.
  const email = customerEmail.toLowerCase().trim();
  let user = await prisma.user.findFirst({ where: { tenantId: bot.tenantId, email } });
  if (!user) {
    user = await prisma.user.create({
      data: { tenantId: bot.tenantId, email, name: customerName, role: "CUSTOMER" },
    });
  }

  const result = await createAppointment({
    tenantId: bot.tenantId,
    userId: user.id,
    productId: product.id,
    appointmentDate: slot.start,
    durationMinutes: duration,
    status: "CONFIRMED",
    customerName,
    customerPhone,
    customerEmail: email,
    notes: notes?.trim() || null,
    petName: pet || null,
    petSpecies: bot.usesPets ? petSpecies ?? null : null,
    calendar: {
      summary: `Cita: ${product.name} - ${customerName}${pet ? ` (${pet})` : ""}`,
      description: `${notes?.trim() || "Cita agendada por WhatsApp"}
Tel: ${customerPhone}`,
      attendeeEmail: email,
    },
  });
  if (!result.ok) {
    return Response.json(
      { success: false, error: "slot_unavailable", message: "Ese horario ya no está disponible." },
      { status: 409 }
    );
  }
  const { appointment, meetLink } = result;

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
