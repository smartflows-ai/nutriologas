// src/lib/google-calendar.ts
// Shared utilities for Google Calendar and Gmail operations (per-tenant).
// Used by internal API endpoints that n8n calls.

const TIMEZONE_OFFSET = "-06:00"; // America/Mexico_City (CST)

const TIME_RANGES: Record<string, { start: string; end: string }> = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "20:00" },
  any: { start: "08:00", end: "20:00" },
};

// ── Google Calendar API ─────────────────────────────────────────

/**
 * Fetch events from the primary calendar within a time range.
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<any[]> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "200",
      }).toString(),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[google-calendar] Error fetching events:", text);
    throw new Error(`Google Calendar API error: ${res.status}`);
  }

  const data = await res.json();
  return data.items ?? [];
}

/**
 * Check for conflicting events in a time range.
 * Returns only real conflicts (opaque, overlapping events).
 */
export async function checkCalendarConflicts(
  accessToken: string,
  startDateTime: string,
  endDateTime: string
): Promise<{ hasConflicts: boolean; conflicts: any[] }> {
  const events = await fetchCalendarEvents(accessToken, startDateTime, endDateTime);

  const userStart = new Date(startDateTime).getTime();
  const userEnd = new Date(endDateTime).getTime();

  const conflicts = events.filter((e: any) => {
    if (!e.start || e.transparency === "transparent") return false;
    if (e.status === "cancelled") return false;

    const eStart = new Date(e.start.dateTime || e.start.date).getTime();
    const eEnd = new Date(e.end.dateTime || e.end.date).getTime();

    // Overlap with 1s tolerance to avoid edge-touching false positives
    return userStart < eEnd - 1000 && userEnd > eStart + 1000;
  });

  return { hasConflicts: conflicts.length > 0, conflicts };
}

/**
 * Create a Google Calendar event with a Google Meet link.
 */
export async function createCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    attendeeEmail: string;
  }
): Promise<any> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
      new URLSearchParams({
        conferenceDataVersion: "1",
        sendUpdates: "all",
      }).toString(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startDateTime, timeZone: "America/Mexico_City" },
        end: { dateTime: event.endDateTime, timeZone: "America/Mexico_City" },
        attendees: [{ email: event.attendeeEmail }],
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: { useDefault: true },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[google-calendar] Error creating event:", text);
    throw new Error(`Failed to create event: ${res.status}`);
  }

  return res.json();
}

// ── Availability Logic ──────────────────────────────────────────

/**
 * Find available time slots for a given date and duration.
 */
export async function findAvailableSlots(
  accessToken: string,
  date: string,
  duration: number,
  timePreference: string = "any"
): Promise<{
  success: boolean;
  availableSlots: string[];
  formattedResponse: string;
  message: string;
}> {
  const range = TIME_RANGES[timePreference] || TIME_RANGES.any;
  const timeMin = `${date}T${range.start}:00${TIMEZONE_OFFSET}`;
  const timeMax = `${date}T${range.end}:00${TIMEZONE_OFFSET}`;

  const events = await fetchCalendarEvents(accessToken, timeMin, timeMax);

  // Extract busy periods
  const busyPeriods = events
    .filter((e: any) => e.start && e.transparency !== "transparent" && e.status !== "cancelled")
    .map((e: any) => ({
      start: new Date(e.start.dateTime || e.start.date).getTime(),
      end: new Date(e.end.dateTime || e.end.date).getTime(),
    }));

  // Generate candidate slots
  const [startHour, startMin] = range.start.split(":").map(Number);
  const [endHour, endMin] = range.end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const availableSlots: string[] = [];
  for (let current = startMinutes; current + duration <= endMinutes; current += duration) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

    // Check if this slot overlaps any busy period
    const slotStart = new Date(`${date}T${timeStr}:00${TIMEZONE_OFFSET}`).getTime();
    const slotEnd = slotStart + duration * 60000;

    const hasConflict = busyPeriods.some(
      (bp) => slotStart < bp.end && slotEnd > bp.start
    );

    if (!hasConflict) {
      availableSlots.push(timeStr);
    }
  }

  const formattedSlots =
    availableSlots.length > 0
      ? availableSlots.map((slot, idx) => `${idx + 1}. ${slot}`).join("\n")
      : "No hay horarios disponibles en este rango.";

  return {
    success: true,
    availableSlots,
    formattedResponse: `Horarios disponibles para ${date}:\n${formattedSlots}`,
    message:
      availableSlots.length > 0
        ? `Encontré ${availableSlots.length} horarios disponibles para una reunión de ${duration} minutos`
        : `Lo siento, no tengo espacios libres el ${date} en ese horario.`,
  };
}

// ── Event Data Preparation ──────────────────────────────────────

/**
 * Prepare event data from raw input (date, time, duration, attendee info).
 */
export function prepareEventData(input: {
  date: string;
  time: string;
  duration: number;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  meetingTopic?: string;
  tenantName?: string;
}) {
  const { date, time, duration, attendeeName, attendeeEmail, attendeePhone, meetingTopic, tenantName } = input;

  // Calculate end time
  const [hour, min] = time.split(":").map(Number);
  const endMinutes = hour * 60 + min + duration;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;

  const startDateTime = `${date}T${time}:00${TIMEZONE_OFFSET}`;
  const endDateTime = `${date}T${endTime}:00${TIMEZONE_OFFSET}`;

  const topic = meetingTopic || "Consulta";
  const client = attendeeName || "Cliente";
  const phone = attendeePhone || "No registrado";
  const business = tenantName || "Negocio";

  const summary = `Consulta ${business}: ${topic} - ${client}`;

  const description = `
<b>Sesión de Consulta - ${business}</b><br>
<b>Tema:</b> ${topic}
<b>Cliente:</b> ${client}
<b>Email:</b> ${attendeeEmail}
<b>Teléfono:</b> ${phone}<br>

Esta sesión ha sido agendada automáticamente por el Asistente Virtual.<br>
Se ha generado un enlace de Google Meet para esta reunión.
`.trim();

  return {
    summary,
    description,
    startDateTime,
    endDateTime,
    attendeeName: client,
    attendeeEmail,
    date,
    time,
    duration,
    topic,
  };
}

// ── Gmail API ───────────────────────────────────────────────────

/**
 * Send an email via Gmail API using the tenant's OAuth token.
 */
export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Build RFC 2822 message
  const messageParts = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(htmlBody).toString("base64"),
  ];

  const rawMessage = Buffer.from(messageParts.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: rawMessage }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[gmail] Error sending email:", text);
    return { success: false, error: `Gmail API error: ${res.status}` };
  }

  const data = await res.json();
  return { success: true, messageId: data.id };
}

/**
 * Build the HTML confirmation email for a calendar event.
 */
export function buildConfirmationEmail(eventData: {
  attendeeName: string;
  attendeeEmail: string;
  date: string;
  time: string;
  duration: number;
  topic: string;
  meetLink: string;
  tenantName: string;
}): string {
  const { attendeeName, date, time, duration, topic, meetLink, tenantName } = eventData;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f7fa;">
    <tr>
      <td align="center" style="padding:40px 15px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#0e3862 0%,#0c5297 50%,#0d4277 100%);padding:50px 30px;">
              <h1 style="margin:0;font-size:28px;color:#ffffff;font-weight:600;">¡Consulta Confirmada!</h1>
              <p style="margin:10px 0 0;font-size:16px;color:rgba(255,255,255,0.9);">Tu videollamada está agendada</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;color:#333333;">
              <p style="font-size:16px;line-height:1.6;margin:0 0 25px;color:#555555;">
                Hola <strong>${attendeeName}</strong>,
              </p>
              <p style="font-size:16px;line-height:1.6;margin:0 0 30px;color:#555555;">
                Gracias por agendar tu consulta con <strong>${tenantName}</strong>. Aquí están los detalles:
              </p>
              <!-- Details Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8f9fb;border-radius:8px;padding:25px;margin-bottom:30px;">
                <tr><td>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:15px;">
                    <tr>
                      <td width="30" valign="top"><span style="font-size:20px;">📅</span></td>
                      <td>
                        <p style="margin:0;font-size:14px;color:#666666;font-weight:500;">Fecha y Hora</p>
                        <p style="margin:5px 0 0;font-size:16px;color:#0c5297;font-weight:600;">${date} - ${time}</p>
                      </td>
                    </tr>
                  </table>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:15px;">
                    <tr>
                      <td width="30" valign="top"><span style="font-size:20px;">⏱️</span></td>
                      <td>
                        <p style="margin:0;font-size:14px;color:#666666;font-weight:500;">Duración</p>
                        <p style="margin:5px 0 0;font-size:16px;color:#333333;font-weight:600;">${duration} minutos</p>
                      </td>
                    </tr>
                  </table>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="30" valign="top"><span style="font-size:20px;">💡</span></td>
                      <td>
                        <p style="margin:0;font-size:14px;color:#666666;font-weight:500;">Tema</p>
                        <p style="margin:5px 0 0;font-size:16px;color:#333333;">${topic}</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:30px;">
                <tr>
                  <td align="center">
                    <a href="${meetLink}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#0c5297,#0e3862);color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
                      🎥 Ir a Videollamada
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:15px;line-height:1.6;margin:0;color:#666666;">
                Si necesitas reprogramar o tienes alguna pregunta, contáctanos.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:30px;background-color:#fafbfc;">
              <p style="margin:0 0 10px;font-size:16px;color:#0c5297;font-weight:600;">${tenantName}</p>
              <p style="margin:0;font-size:12px;color:#999999;">Este correo fue enviado porque agendaste una consulta.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
