// src/app/api/internal/bot/book/route.ts
// POST: Book an appointment for the WhatsApp customer. Creates the Appointment row first,
// then mirrors it to the tenant's Google Calendar when connected.
//
// Two request versions share this route:
// - legacy (no `intake` field): name and a valid email are required, no age or modality. Used by workflows that
//   have not been re-imported yet.
// - intake "v2": a known patient (the number already booked here) is never asked anything again; a new patient
//   needs name and age; the email is optional (without it no calendar invitation is sent); the modality (in
//   person or online) is resolved from the business setting or the patient's choice.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createAppointment } from "@/lib/appointments-service";
import { buildCalendarText } from "@/lib/appointment-calendar-text";
import { buildSlot, formatSlotTime, isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { isBookable } from "@/lib/bookable";
import { cleanPetName } from "@/lib/pets";
import { patientKeyOf } from "@/lib/patient-key";
import { getKnownPatient } from "@/lib/patients";
import { guestEmailFor, mergePatient, missingIntake, resolveModality, type Modality } from "@/lib/patient-intake";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PatientData {
  name: string;
  email: string | null;
  age: number | null;
  modality: Modality | null;
}

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { instance, productId, date, time, customerName, customerPhone, customerEmail, customerAge, modality, notes, petName, petSpecies, intake } = body;
  const isV2 = intake === "v2";

  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  if (!productId || !date || !time || !customerPhone || (!isV2 && !customerName)) {
    return Response.json(
      { success: false, error: "Faltan datos: productId, date, time, customerName, customerPhone" },
      { status: 400 }
    );
  }

  // Who is booking: a registered patient comes from their latest visit, a new one from what the agent collected.
  const patientKey = patientKeyOf(String(customerPhone));
  let patient: PatientData;
  if (isV2) {
    if (!patientKey) {
      return Response.json({ success: false, error: "Faltan datos: customerPhone" }, { status: 400 });
    }
    const known = await getKnownPatient(bot.tenantId, patientKey);
    const missing = missingIntake(known, { name: customerName, age: customerAge });
    const merged = mergePatient(known, { name: customerName, age: customerAge, email: customerEmail });
    if (!merged.name && !missing.includes("name")) missing.push("name");
    if (missing.length > 0) {
      return Response.json(
        {
          success: false,
          error: "patient_info_required",
          missing,
          message: "Es la primera cita de este paciente: pide los datos que faltan (nombre completo y edad) antes de agendar.",
        },
        { status: 400 }
      );
    }
    // A typed email must be valid; no email at all is fine.
    const typedEmail = typeof customerEmail === "string" ? customerEmail.trim() : "";
    if (typedEmail && !EMAIL_REGEX.test(typedEmail)) {
      return Response.json(
        { success: false, error: "invalid_email", message: "El correo no parece válido: pídelo de nuevo o confirma que no quiere dar uno." },
        { status: 400 }
      );
    }
    const resolved = resolveModality(bot.serviceModes, modality);
    if (!resolved.ok) {
      return Response.json(
        { success: false, error: resolved.error, message: "Pregunta al paciente si la cita es presencial o en línea." },
        { status: 400 }
      );
    }
    patient = { name: merged.name as string, email: merged.email, age: merged.age, modality: resolved.modality };
  } else {
    if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
      return Response.json(
        { success: false, error: "email_required", message: "Pide al cliente un correo electrónico válido para enviarle la invitación." },
        { status: 400 }
      );
    }
    patient = { name: customerName, email: customerEmail.toLowerCase().trim(), age: null, modality: null };
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

  // Guest account per patient: by email when there is one, otherwise a stable placeholder per phone number.
  const accountEmail = patient.email ?? guestEmailFor(patientKey ?? String(customerPhone).replace(/\D/g, ""));
  let user = await prisma.user.findFirst({ where: { tenantId: bot.tenantId, email: accountEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: { tenantId: bot.tenantId, email: accountEmail, name: patient.name, role: "CUSTOMER" },
    });
  }

  const reason = notes?.trim() || null;
  const calendarText = buildCalendarText({
    serviceName: product.name,
    customerName: patient.name,
    petName: pet || null,
    reason,
    fallbackReason: "Cita agendada por WhatsApp",
    phone: customerPhone,
    age: patient.age,
    modality: patient.modality,
  });

  const result = await createAppointment({
    tenantId: bot.tenantId,
    userId: user.id,
    productId: product.id,
    appointmentDate: slot.start,
    durationMinutes: duration,
    status: "CONFIRMED",
    customerName: patient.name,
    customerPhone,
    customerEmail: patient.email,
    customerAge: patient.age,
    modality: patient.modality,
    notes: reason,
    petName: pet || null,
    petSpecies: bot.usesPets ? petSpecies ?? null : null,
    calendar: {
      summary: calendarText.summary,
      description: calendarText.description,
      // No email means no invitation: the event only lands on the doctor's calendar.
      attendeeEmail: patient.email ?? undefined,
      location: bot.addressText,
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
      modality: patient.modality,
      // The video link for an online visit; null when none could be created (the clinic sends it) or in person.
      meetLink,
      // Office address and map link for an in person visit (or any visit in the legacy version).
      location: patient.modality === "ONLINE" ? null : bot.locationText || null,
    },
    { status: 201 }
  );
}
