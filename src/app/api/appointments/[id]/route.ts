// src/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const userId = session.user.id!;
    const isAdmin = (session.user as any).role === "ADMIN";

    const appointment = await prisma.appointment.findFirst({
      where: { id: params.id, tenantId },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    // Si no es admin y no es el dueño de la cita
    if (!isAdmin && appointment.userId !== userId) {
      return NextResponse.json({ error: "No autorizado para modificar esta cita" }, { status: 403 });
    }

    const body = await req.json();
    const { status, internalNotes, notes, appointmentDate } = body;

    const dataToUpdate: any = {};

    if (status) {
      // Clientes solo pueden CANCELAR su propia cita
      if (!isAdmin && status !== "CANCELLED") {
        return NextResponse.json({ error: "Solo puedes cancelar tu cita" }, { status: 403 });
      }
      dataToUpdate.status = status;
    }

    if (isAdmin && internalNotes !== undefined) {
      dataToUpdate.internalNotes = internalNotes;
    }

    if (notes !== undefined) {
      dataToUpdate.notes = notes;
    }

    if (isAdmin && appointmentDate) {
      dataToUpdate.appointmentDate = new Date(appointmentDate);
    }

    const updated = await prisma.appointment.update({
      where: { id: params.id },
      data: dataToUpdate,
      include: {
        product: { select: { name: true, durationMinutes: true, price: true } },
        user: { select: { name: true, email: true } },
      },
    });

    let whatsappSent = false;
    let whatsappReason: string | undefined;

    // Cuando el doctor o admin confirma la cita, notificar al paciente por WhatsApp
    if (status === "CONFIRMED") {
      let patientPhone = updated.customerPhone;
      if (!patientPhone && updated.notes) {
        const match = updated.notes.match(/(?:Tel|WhatsApp|Cel|Teléfono)?[:\s]*([+0-9]{8,15})/i);
        if (match) patientPhone = match[1];
      }

      if (patientPhone) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        const tenantName = tenant?.name || "Clínica";
        const patientName = updated.customerName || updated.user?.name || "Paciente";
        const serviceName = updated.product?.name || "Consulta Médica";

        const formattedDate = new Date(updated.appointmentDate).toLocaleDateString("es-MX", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const formattedTime = new Date(updated.appointmentDate).toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

        const message = `¡Hola, ${patientName}! 👋\n\nTu cita en *${tenantName}* ha sido *CONFIRMADA* con éxito por el especialista. 🩺✨\n\n📅 *Fecha:* ${formattedDate}\n⏰ *Horario:* ${formattedTime}\n🩺 *Servicio:* ${serviceName}\n⏱️ *Duración estimada:* ${updated.durationMinutes} min\n\nSi tienes alguna duda o necesitas reagendar, puedes responder a este mensaje. ¡Te esperamos!`;

        const waRes = await sendWhatsAppMessage({
          tenantId,
          to: patientPhone,
          text: message,
        });

        whatsappSent = waRes.success;
        whatsappReason = waRes.reason;
      }
    }

    return NextResponse.json({ ...updated, whatsappSent, whatsappReason });
  } catch (error: any) {
    console.error("[PATCH /api/appointments/[id]] Error:", error);
    return NextResponse.json({ error: error.message || "Error al actualizar cita" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;

    const appointment = await prisma.appointment.findFirst({
      where: { id: params.id, tenantId },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    await prisma.appointment.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[DELETE /api/appointments/[id]] Error:", error);
    return NextResponse.json({ error: error.message || "Error al eliminar cita" }, { status: 500 });
  }
}
