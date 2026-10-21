// src/lib/appointment-notes.ts
// Clinical notes per visit, linked to the patient through the phone-based patient key (src/lib/patient-key.ts).
// Appointment.internalNotes keeps the latest text (used by the calendar and the assistant); AppointmentNote keeps history.
import { prisma } from "@/lib/db";
import { patientKeyOf } from "@/lib/patient-key";

interface NoteAppointment {
  id: string;
  tenantId: string;
  customerPhone: string | null;
}

/**
 * Saves the note of one visit. Editing a visit's note updates its row, so each visit has one note.
 * An empty text removes this visit's note. Without a usable phone there is no patient key, so the note
 * stays only on the appointment.
 */
export async function saveVisitNote(appointment: NoteAppointment, text: string, authorName: string | null) {
  const patientKey = patientKeyOf(appointment.customerPhone);
  if (!patientKey) return;

  const body = text.trim();
  if (!body) {
    await prisma.appointmentNote.deleteMany({ where: { appointmentId: appointment.id, tenantId: appointment.tenantId } });
    return;
  }

  const existing = await prisma.appointmentNote.findFirst({
    where: { appointmentId: appointment.id, tenantId: appointment.tenantId },
    select: { id: true },
  });
  if (existing) {
    await prisma.appointmentNote.update({ where: { id: existing.id }, data: { body, authorName } });
  } else {
    await prisma.appointmentNote.create({
      data: { tenantId: appointment.tenantId, patientKey, appointmentId: appointment.id, body, authorName },
    });
  }
}

/** Every note of one patient in this tenant, newest visit first, with the visit date and service. */
export async function patientNotesHistory(tenantId: string, customerPhone: string | null) {
  const patientKey = patientKeyOf(customerPhone);
  if (!patientKey) return [];

  const notes = await prisma.appointmentNote.findMany({
    where: { tenantId, patientKey },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      authorName: true,
      createdAt: true,
      appointment: {
        select: { id: true, appointmentDate: true, status: true, product: { select: { name: true } } },
      },
    },
  });
  return notes;
}
