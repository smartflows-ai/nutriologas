// src/lib/microsoft-calendar.ts
// Microsoft Graph (Outlook Calendar) helpers, per tenant. Mirrors google-calendar.ts so the
// calendar sync layer treats both providers the same way.

const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const TIME_ZONE = "UTC"; // Graph times are sent in UTC; the UI converts to the tenant's zone

function toGraphDateTime(date: Date) {
  return { dateTime: date.toISOString().replace("Z", ""), timeZone: TIME_ZONE };
}

/** Graph returns UTC wall times without a suffix when asked for the UTC preference. */
export function parseGraphDateTime(value: string): Date {
  return new Date(value.endsWith("Z") ? value : `${value}Z`);
}

/**
 * Events in a time range, expanded by Graph (recurrences included).
 */
export async function fetchMicrosoftEvents(accessToken: string, timeMin: string, timeMax: string): Promise<any[]> {
  const res = await fetch(
    `${GRAPH_URL}/me/calendarView?` +
      new URLSearchParams({
        startDateTime: timeMin,
        endDateTime: timeMax,
        $top: "200",
        $orderby: "start/dateTime",
      }).toString(),
    { headers: { Authorization: `Bearer ${accessToken}`, Prefer: `outlook.timezone="${TIME_ZONE}"` } }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[microsoft-calendar] Error fetching events:", text);
    throw new Error(`Microsoft Calendar API error: ${res.status}`);
  }

  const data = await res.json();
  return data.value ?? [];
}

/**
 * Create an Outlook event. Returns the id Graph assigned.
 */
export async function createMicrosoftEvent(
  accessToken: string,
  event: {
    subject: string;
    body: string;
    start: Date;
    end: Date;
    attendeeEmail?: string;
  }
): Promise<{ id: string; webLink: string | null }> {
  const res = await fetch(`${GRAPH_URL}/me/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.subject,
      body: { contentType: "Text", content: event.body },
      start: toGraphDateTime(event.start),
      end: toGraphDateTime(event.end),
      attendees: event.attendeeEmail
        ? [{ emailAddress: { address: event.attendeeEmail }, type: "required" }]
        : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[microsoft-calendar] Error creating event:", text);
    throw new Error(`Failed to create Outlook event: ${res.status}`);
  }

  const data = await res.json();
  return { id: data.id, webLink: data.webLink ?? null };
}

/**
 * Move an existing Outlook event (reschedule).
 */
export async function updateMicrosoftEvent(
  accessToken: string,
  eventId: string,
  range: { start: Date; end: Date }
): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/me/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start: toGraphDateTime(range.start),
      end: toGraphDateTime(range.end),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[microsoft-calendar] Error updating event:", text);
    throw new Error(`Failed to update Outlook event: ${res.status}`);
  }
}

/**
 * Delete an Outlook event (cancellation). A 404 or 410 means it is already gone.
 */
export async function deleteMicrosoftEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/me/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    console.error("[microsoft-calendar] Error deleting event:", text);
    throw new Error(`Failed to delete Outlook event: ${res.status}`);
  }
}
