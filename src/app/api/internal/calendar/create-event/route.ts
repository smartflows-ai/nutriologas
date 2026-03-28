// src/app/api/internal/calendar/create-event/route.ts
// Called by n8n to create a Google Calendar event with Meet link + send confirmation email,
// using the tenant's own Google credentials.
import { NextRequest } from "next/server";
import { getAppToken } from "@/lib/connected-apps";
import { prisma } from "@/lib/db";
import {
  prepareEventData,
  checkCalendarConflicts,
  createCalendarEvent,
  sendGmailMessage,
  buildConfirmationEmail,
} from "@/lib/google-calendar";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (key !== process.env.INTERNAL_API_KEY) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { tenantId, date, time, duration, attendeeName, attendeeEmail, attendeePhone, meetingTopic } = body;

  if (!tenantId || !date || !time || !duration || !attendeeName || !attendeeEmail) {
    return Response.json(
      { success: false, error: "Missing required fields: tenantId, date, time, duration, attendeeName, attendeeEmail" },
      { status: 400 }
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(attendeeEmail)) {
    return Response.json(
      { success: false, error: "Formato de email inválido" },
      { status: 400 }
    );
  }

  const accessToken = await getAppToken(tenantId, "GOOGLE");
  if (!accessToken) {
    return Response.json(
      { success: false, error: "Google Calendar no conectado para este tenant. El admin debe conectar Google desde Apps." },
      { status: 400 }
    );
  }

  // Get tenant name for the email
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const tenantName = tenant?.name || "Negocio";

  try {
    // 1. Prepare event data
    const eventData = prepareEventData({
      date,
      time,
      duration: Number(duration),
      attendeeName,
      attendeeEmail,
      attendeePhone,
      meetingTopic,
      tenantName,
    });

    // 2. Check for conflicts
    const { hasConflicts, conflicts } = await checkCalendarConflicts(
      accessToken,
      eventData.startDateTime,
      eventData.endDateTime
    );

    if (hasConflicts) {
      const conflictDetails = conflicts
        .map((c: any) => `• ${c.summary || "(sin título)"} (${c.start?.dateTime || c.start?.date} - ${c.end?.dateTime || c.end?.date})`)
        .join("\n");

      return Response.json({
        success: false,
        error: "Slot occupied",
        message: `El horario ${time} choca con estos eventos existentes:\n${conflictDetails}`,
        conflicts: conflicts.map((c: any) => ({
          summary: c.summary,
          start: c.start?.dateTime || c.start?.date,
          end: c.end?.dateTime || c.end?.date,
        })),
      });
    }

    // 3. Create the calendar event with Meet link
    const createdEvent = await createCalendarEvent(accessToken, {
      summary: eventData.summary,
      description: eventData.description,
      startDateTime: eventData.startDateTime,
      endDateTime: eventData.endDateTime,
      attendeeEmail,
    });

    const meetLink =
      createdEvent.hangoutLink ||
      createdEvent.conferenceData?.entryPoints?.[0]?.uri ||
      "Link de Meet será enviado por email";

    // 4. Send confirmation email via tenant's Gmail
    const emailHtml = buildConfirmationEmail({
      attendeeName: eventData.attendeeName,
      attendeeEmail,
      date: eventData.date,
      time: eventData.time,
      duration: eventData.duration,
      topic: eventData.topic,
      meetLink,
      tenantName,
    });

    const emailResult = await sendGmailMessage(
      accessToken,
      attendeeEmail,
      `📅 Consulta Confirmada - ${tenantName}`,
      emailHtml
    );

    if (!emailResult.success) {
      console.error("[internal/calendar/create-event] Email send failed:", emailResult.error);
      // Event was created successfully — don't fail the whole request
    }

    return Response.json({
      success: true,
      message: `Evento creado exitosamente para ${date} a las ${time}`,
      eventId: createdEvent.id,
      meetLink,
      emailSent: emailResult.success,
      summary: {
        attendee: eventData.attendeeName,
        email: attendeeEmail,
        date: eventData.date,
        time: eventData.time,
        duration: `${eventData.duration} minutos`,
        topic: eventData.topic,
      },
    });
  } catch (err: any) {
    console.error("[internal/calendar/create-event] Error:", err);
    return Response.json(
      { success: false, error: err.message || "Error creating event" },
      { status: 500 }
    );
  }
}
