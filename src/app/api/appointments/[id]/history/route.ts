// src/app/api/appointments/[id]/history/route.ts
// GET: clinical notes of the patient of this appointment, across all visits. Admin only.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { patientNotesHistory } from "@/lib/appointment-notes";
import { patientKeyOf } from "@/lib/patient-key";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return apiError("unauthorized", 401);
    }

    const tenantId = (session.user as any).tenantId;
    const appointment = await prisma.appointment.findFirst({
      where: { id: params.id, tenantId },
      select: { customerPhone: true },
    });
    if (!appointment) return apiError("appointment_not_found", 404);

    const patientKey = patientKeyOf(appointment.customerPhone);
    const notes = await patientNotesHistory(tenantId, appointment.customerPhone);
    return NextResponse.json({ patientKey, linked: patientKey !== null, notes });
  } catch (error) {
    console.error("[GET /api/appointments/[id]/history] Error:", error);
    return apiError("internal_error", 500);
  }
}
