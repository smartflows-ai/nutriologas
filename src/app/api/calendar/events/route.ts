// src/app/api/calendar/events/route.ts
// Fetches real events from the authenticated admin's Google Calendar.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;

  // Get admin's Google Calendar token
  const admin = await prisma.user.findFirst({
    where: { tenantId, role: "ADMIN" },
    select: {
      googleCalendarToken: true,
      googleCalendarRefreshToken: true,
      googleCalendarTokenExpiry: true,
    },
  });

  if (!admin?.googleCalendarToken) {
    return NextResponse.json({ error: "Google Calendar no conectado" }, { status: 400 });
  }

  let accessToken = admin.googleCalendarToken;

  // Refresh token if expired
  if (admin.googleCalendarTokenExpiry && new Date() > admin.googleCalendarTokenExpiry) {
    if (admin.googleCalendarRefreshToken) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID ?? "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          refresh_token: admin.googleCalendarRefreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;
        // Update the stored token
        await prisma.user.updateMany({
          where: { tenantId, role: "ADMIN" },
          data: {
            googleCalendarToken: accessToken,
            googleCalendarTokenExpiry: refreshData.expires_in
              ? new Date(Date.now() + refreshData.expires_in * 1000)
              : null,
          },
        });
      }
    }
  }

  // Pad by 1 day on each side: FullCalendar sends UTC midnight, but all-day events in Google
  // are stored as midnight UTC which can fall BEFORE timeMin when the user is UTC-N. 
  // FullCalendar still only renders events within the visible window.
  const { searchParams } = new URL(req.url);
  const rawStart = new Date(searchParams.get("start") ?? Date.now() - 7 * 86400000);
  const rawEnd = new Date(searchParams.get("end") ?? Date.now() + 30 * 86400000);
  const timeMin = new Date(rawStart.getTime() - 86400000).toISOString();
  const timeMax = new Date(rawEnd.getTime() + 86400000).toISOString();

  // Step 1: Get list of all calendars
  const calListRes = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const calListData = await calListRes.json();
  const calendarList: any[] = calListData.items ?? [];
  const calendarIds: string[] = calendarList.map((c: any) => c.id);

  // Identify the primary calendar so we can exclude public/subscribed calendars from metrics
  const primaryCal = calendarList.find((c: any) => c.primary === true);
  const primaryCalId: string = primaryCal?.id ?? "primary";

  if (calendarIds.length === 0) {
    console.log("[calendar/events] No calendars found for user");
    return NextResponse.json({ events: [], stats: { total: 0, attended: 0, cancelled: 0 } });
  }

  // Step 2: Fetch events from each calendar in parallel
  // Tag each item with its source calendarId so we can filter metrics later
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
        // Attach the source calendarId to each item for later metric filtering
        (d.items ?? []).forEach((item: any) => { item._calendarId = calId; });
        allItems.push(...(d.items ?? []));
      }
    })
  );

  const now = new Date();

  // Map to FullCalendar event format 
  const events = allItems.map((item: any) => {
    const isAllDay = !!item.start?.date;
    const startStr = isAllDay ? item.start.date : item.start.dateTime;
    const startDate = new Date(startStr);
    const googleCancelled = item.status === "cancelled";
    const calOwnerEmail = primaryCal?.id ?? ""; // el id del calendario primario ES el email


    let status: "attended" | "pending" | "cancelled";
    let color: string;
    if (googleCancelled) {
      status = "cancelled"; color = "#ef4444";
    } else if (startDate < now) {
      status = "attended"; color = "#16a34a"; // past → attended
    } else {
      status = "pending"; color = "#f59e0b"; // future → pending (amber)
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
        calendarOwnerEmail: calOwnerEmail,
        _calendarId: item._calendarId,
      },
    };
  });

  // Stats only count events from the primary (own) calendar.
  // Public/subscribed calendars (holidays, birthdays, etc.) are shown on the
  // calendar view but intentionally excluded from the metrics.
  const primaryEvents = allItems
    .filter((item: any) => item._calendarId === primaryCalId)
    .map((item: any) => {
      const isAllDay = !!item.start?.date;
      const startStr = isAllDay ? item.start.date : item.start.dateTime;
      const startDate = new Date(startStr);
      const googleCancelled = item.status === "cancelled";
      if (googleCancelled) return "cancelled";
      if (startDate < now) return "attended";
      return "pending";
    });

  const total = primaryEvents.length;
  const cancelled = primaryEvents.filter((s) => s === "cancelled").length;
  const attended = primaryEvents.filter((s) => s === "attended").length;
  const pending = primaryEvents.filter((s) => s === "pending").length;

  return NextResponse.json({ events, stats: { total, attended, cancelled, pending } });
}
