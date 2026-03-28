// src/app/api/calendar/events/route.ts
// Fetches real events from Google Calendar or Microsoft Outlook
// using the centralized connected_apps table.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAppToken, getConnectedProvider } from "@/lib/connected-apps";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;

  // Detect which calendar provider is connected
  const provider = await getConnectedProvider(tenantId, ["GOOGLE", "MICROSOFT"]);
  if (!provider) {
    return NextResponse.json(
      { error: "Ningún calendario conectado. Ve a Apps para conectar Google o Microsoft." },
      { status: 400 }
    );
  }

  const accessToken = await getAppToken(tenantId, provider);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Token expirado o inválido. Reconecta la app desde Apps." },
      { status: 400 }
    );
  }

  // Pad by 1 day on each side for timezone edge cases
  const { searchParams } = new URL(req.url);
  const rawStart = new Date(searchParams.get("start") ?? Date.now() - 7 * 86400000);
  const rawEnd = new Date(searchParams.get("end") ?? Date.now() + 30 * 86400000);
  const timeMin = new Date(rawStart.getTime() - 86400000).toISOString();
  const timeMax = new Date(rawEnd.getTime() + 86400000).toISOString();

  if (provider === "GOOGLE") {
    return fetchGoogleCalendar(accessToken, timeMin, timeMax);
  } else {
    return fetchMicrosoftCalendar(accessToken, timeMin, timeMax);
  }
}

// ── Google Calendar ────────────────────────────────────────────────
async function fetchGoogleCalendar(accessToken: string, timeMin: string, timeMax: string) {
  // Fetch events directly from the primary calendar.
  // Note: calendar.events scope allows reading events from "primary"
  // but does NOT allow listing all calendars via calendarList API.
  // If calendarList is available, also fetch from secondary calendars.
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
    // calendarList not available (insufficient scopes) — just use "primary"
  }

  // Fetch events from each calendar in parallel
  const allItems: any[] = [];
  await Promise.all(
    calendarIds.map(async (calId: string) => {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` +
        new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "100" }).toString(),
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const d = await res.json();
        (d.items ?? []).forEach((item: any) => { item._calendarId = calId; });
        allItems.push(...(d.items ?? []));
      }
    })
  );

  const now = new Date();

  const events = allItems.map((item: any) => {
    const isAllDay = !!item.start?.date;
    const startStr = isAllDay ? item.start.date : item.start.dateTime;
    const startDate = new Date(startStr);
    const googleCancelled = item.status === "cancelled";

    let status: "attended" | "pending" | "cancelled";
    let color: string;
    if (googleCancelled) {
      status = "cancelled"; color = "#ef4444";
    } else if (startDate < now) {
      status = "attended"; color = "#16a34a";
    } else {
      status = "pending"; color = "#f59e0b";
    }

    return {
      id: item.id,
      title: item.summary ?? "(sin título)",
      start: startStr,
      end: isAllDay ? item.end?.date : item.end?.dateTime,
      allDay: isAllDay,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        status,
        description: item.description ?? "",
        location: item.location ?? "",
        htmlLink: item.htmlLink ?? "",
        eventId: item.id,
        calendarId: item._calendarId,
        calendarOwnerEmail: primaryCalEmail,
        _calendarId: item._calendarId,
      },
    };
  });

  // Stats from all fetched events
  const statuses = events.map((e) => e.extendedProps.status);

  return NextResponse.json({
    events,
    stats: {
      total: statuses.length,
      attended: statuses.filter((s) => s === "attended").length,
      cancelled: statuses.filter((s) => s === "cancelled").length,
      pending: statuses.filter((s) => s === "pending").length,
    },
  });
}

// ── Microsoft Outlook Calendar ─────────────────────────────────────
async function fetchMicrosoftCalendar(accessToken: string, timeMin: string, timeMax: string) {
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

  if (!res.ok) {
    console.error("[calendar] Microsoft Graph error:", await res.text());
    return NextResponse.json({ error: "Error al leer calendario de Microsoft" }, { status: 502 });
  }

  const data = await res.json();
  const items: any[] = data.value ?? [];
  const now = new Date();

  const events = items.map((item: any) => {
    const isAllDay = item.isAllDay ?? false;
    const startStr = item.start?.dateTime
      ? new Date(item.start.dateTime + "Z").toISOString()
      : item.start?.dateTime;
    const endStr = item.end?.dateTime
      ? new Date(item.end.dateTime + "Z").toISOString()
      : item.end?.dateTime;
    const startDate = new Date(startStr);
    const msCancelled = item.isCancelled === true;

    let status: "attended" | "pending" | "cancelled";
    let color: string;
    if (msCancelled) {
      status = "cancelled"; color = "#ef4444";
    } else if (startDate < now) {
      status = "attended"; color = "#16a34a";
    } else {
      status = "pending"; color = "#f59e0b";
    }

    return {
      id: item.id,
      title: item.subject ?? "(sin título)",
      start: startStr,
      end: endStr,
      allDay: isAllDay,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        status,
        description: item.bodyPreview ?? "",
        location: item.location?.displayName ?? "",
        htmlLink: item.webLink ?? "",
        eventId: item.id,
      },
    };
  });

  const total = items.length;
  const cancelled = events.filter((e) => e.extendedProps.status === "cancelled").length;
  const attended = events.filter((e) => e.extendedProps.status === "attended").length;
  const pending = events.filter((e) => e.extendedProps.status === "pending").length;

  return NextResponse.json({ events, stats: { total, attended, cancelled, pending } });
}
