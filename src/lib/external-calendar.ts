// src/lib/external-calendar.ts
// Unified external calendar helper (Google Calendar & Microsoft Outlook)
import { getAppToken, getConnectedProvider } from "@/lib/connected-apps";
import { linkKey } from "@/lib/calendar-sync";

export interface ExternalAppointmentItem {
  id: string;
  source: "google" | "microsoft";
  externalEventId: string; // raw id in the external calendar
  tenantId: string;
  userId: string;
  productId: string;
  customerName: string;
  customerPhone: string | null;
  appointmentDate: string;
  durationMinutes: number;
  notes: string | null;
  internalNotes: string | null;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  createdAt: string;
  htmlLink?: string;
  product: {
    id: string;
    name: string;
    price: number;
    durationMinutes: number | null;
    category: string | null;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export async function fetchExternalAppointments(
  tenantId: string,
  timeMin?: string,
  timeMax?: string
): Promise<ExternalAppointmentItem[]> {
  try {
    const provider = await getConnectedProvider(tenantId, ["GOOGLE", "MICROSOFT"]);
    if (!provider) return [];

    const accessToken = await getAppToken(tenantId, provider);
    if (!accessToken) return [];

    // Default time range: 3 months past to 3 months future
    const now = new Date();
    const min = timeMin || new Date(now.getTime() - 90 * 86400000).toISOString();
    const max = timeMax || new Date(now.getTime() + 90 * 86400000).toISOString();

    if (provider === "GOOGLE") {
      return await fetchGoogleCalendarAppointments(tenantId, accessToken, min, max);
    } else {
      return await fetchMicrosoftCalendarAppointments(tenantId, accessToken, min, max);
    }
  } catch (err) {
    console.warn("[fetchExternalAppointments] Error loading external appointments:", err);
    return [];
  }
}

async function fetchGoogleCalendarAppointments(
  tenantId: string,
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<ExternalAppointmentItem[]> {
  let calendarIds: string[] = ["primary"];
  let primaryCalEmail = "";

  try {
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (calListRes.ok) {
      const calListData = await calListRes.json();
      const calendarList: any[] = calListData.items ?? [];
      if (calendarList.length > 0) {
        calendarIds = calendarList.map((c: any) => c.id);
        const primaryCal = calendarList.find((c: any) => c.primary === true);
        primaryCalEmail = primaryCal?.id ?? "";
      }
    }
  } catch {
    // Fallback to primary
  }

  const allItems: any[] = [];
  await Promise.all(
    calendarIds.map(async (calId: string) => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` +
          new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "100",
          }).toString(),
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const d = await res.json();
          (d.items ?? []).forEach((item: any) => { item._calendarId = calId; });
          allItems.push(...(d.items ?? []));
        }
      } catch (e) {
        console.warn(`[Google Calendar] Could not fetch events for ${calId}:`, e);
      }
    })
  );

  const now = new Date();

  return allItems.map((item: any) => {
    const isAllDay = !!item.start?.date;
    const startStr = isAllDay ? `${item.start.date}T09:00:00.000Z` : (item.start?.dateTime || new Date().toISOString());
    const endStr = isAllDay ? `${item.end?.date}T10:00:00.000Z` : (item.end?.dateTime || startStr);
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const durationMinutes = Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / 60000)) || 30;

    const isCancelled = item.status === "cancelled";
    let status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" = "CONFIRMED";

    if (isCancelled) {
      status = "CANCELLED";
    } else if (startDate < now) {
      status = "COMPLETED";
    } else {
      status = "CONFIRMED";
    }

    // Extract patient name or attendee name
    const attendee = item.attendees?.find((a: any) => !a.self) || item.attendees?.[0];
    const customerName = attendee?.displayName || item.summary || "Cita de Google Calendar";
    const customerEmail = attendee?.email || item.creator?.email || primaryCalEmail || "";

    // Extract phone if mentioned in description
    let phone: string | null = null;
    if (item.description) {
      const match = item.description.match(/(?:Tel|WhatsApp|Cel|Teléfono)?[:\s]*([+0-9]{8,15})/i);
      if (match) phone = match[1];
    }

    return {
      id: `google_${item.id}`,
      source: "google",
      externalEventId: item.id,
      tenantId,
      userId: `ext_google_${item.id}`,
      productId: `ext_google`,
      customerName,
      customerPhone: phone,
      appointmentDate: startDate.toISOString(),
      durationMinutes,
      notes: item.description || (item.summary ? `Evento: ${item.summary}` : null),
      internalNotes: item.location ? `Ubicación: ${item.location}` : null,
      status,
      createdAt: item.created || startDate.toISOString(),
      htmlLink: item.htmlLink || undefined,
      product: {
        id: `ext_google`,
        name: item.summary || "Evento Google Calendar",
        price: 0,
        durationMinutes,
        category: "Google Calendar",
      },
      user: {
        id: `ext_google_${item.id}`,
        name: customerName,
        email: customerEmail,
        image: null,
      },
    };
  });
}

async function fetchMicrosoftCalendarAppointments(
  tenantId: string,
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<ExternalAppointmentItem[]> {
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?` +
      new URLSearchParams({
        startDateTime: timeMin,
        endDateTime: timeMax,
        $top: "200",
        $orderby: "start/dateTime",
      }).toString(),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const items: any[] = data.value ?? [];
    const now = new Date();

    return items.map((item: any) => {
      const isAllDay = item.isAllDay ?? false;
      const startStr = item.start?.dateTime
        ? (item.start.dateTime.endsWith("Z") ? item.start.dateTime : `${item.start.dateTime}Z`)
        : new Date().toISOString();
      const endStr = item.end?.dateTime
        ? (item.end.dateTime.endsWith("Z") ? item.end.dateTime : `${item.end.dateTime}Z`)
        : startStr;
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      const durationMinutes = Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / 60000)) || 30;

      const isCancelled = item.isCancelled === true;
      let status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" = "CONFIRMED";

      if (isCancelled) {
        status = "CANCELLED";
      } else if (startDate < now) {
        status = "COMPLETED";
      } else {
        status = "CONFIRMED";
      }

      const customerName = item.subject || "Cita de Outlook";

      return {
        id: `ms_${item.id}`,
        source: "microsoft",
        externalEventId: item.id,
        tenantId,
        userId: `ext_ms_${item.id}`,
        productId: `ext_ms`,
        customerName,
        customerPhone: null,
        appointmentDate: startDate.toISOString(),
        durationMinutes,
        notes: item.bodyPreview || null,
        internalNotes: item.location?.displayName ? `Ubicación: ${item.location.displayName}` : null,
        status,
        createdAt: item.createdDateTime || startDate.toISOString(),
        htmlLink: item.webLink || undefined,
        product: {
          id: `ext_ms`,
          name: item.subject || "Evento Outlook",
          price: 0,
          durationMinutes,
          category: "Outlook Calendar",
        },
        user: {
          id: `ext_ms_${item.id}`,
          name: customerName,
          email: item.organizer?.emailAddress?.address || "",
          image: null,
        },
      };
    });
  } catch (err) {
    console.warn("[Microsoft Calendar] Error fetching events:", err);
    return [];
  }
}

/**
 * Drops external events that a native appointment already mirrors, so each booking shows once.
 */
export function dropLinkedExternal<T extends { source: "google" | "microsoft"; externalEventId: string }>(
  items: T[],
  linked: Set<string>
): T[] {
  return items.filter((item) => {
    const provider = item.source === "google" ? "GOOGLE" : "MICROSOFT";
    return !linked.has(linkKey(provider, item.externalEventId));
  });
}
