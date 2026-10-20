// src/app/api/calendar/events/route.ts
// Unified events endpoint returning both native CRM appointments and external Google/Microsoft events
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppToken, getConnectedProvider } from "@/lib/connected-apps";
import { linkedEventKeys, linkKey } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;

  const { searchParams } = new URL(req.url);
  const rawStart = new Date(searchParams.get("start") ?? Date.now() - 7 * 86400000);
  const rawEnd = new Date(searchParams.get("end") ?? Date.now() + 30 * 86400000);
  const timeMin = new Date(rawStart.getTime() - 86400000).toISOString();
  const timeMax = new Date(rawEnd.getTime() + 86400000).toISOString();

  // 1. Cargar citas nativas del CRM (creadas vía web, WhatsApp o recepcionista)
  let nativeEvents: any[] = [];
  let linked = new Set<string>();
  try {
    const nativeAppts = await prisma.appointment.findMany({
      where: {
        tenantId,
        appointmentDate: {
          gte: new Date(rawStart.getTime() - 86400000),
          lte: new Date(rawEnd.getTime() + 86400000),
        },
      },
      include: {
        product: { select: { name: true, durationMinutes: true, price: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { appointmentDate: "asc" },
    });

    linked = linkedEventKeys(nativeAppts);

    nativeEvents = nativeAppts.map((a) => {
      const start = a.appointmentDate;
      const end = new Date(start.getTime() + (a.durationMinutes || 30) * 60000);
      const patientName = a.customerName || a.user?.name || "Paciente";
      const serviceName = a.product?.name || "Consulta Médica";

      let status: "attended" | "pending" | "cancelled" = "pending";
      let color = "#f59e0b"; // amber for pending

      if (a.status === "CONFIRMED") {
        status = "attended";
        color = "#16a34a"; // emerald
      } else if (a.status === "COMPLETED") {
        status = "attended";
        color = "#2563eb"; // blue
      } else if (a.status === "CANCELLED" || a.status === "NO_SHOW") {
        status = "cancelled";
        color = "#ef4444"; // red
      }

      return {
        id: `native_${a.id}`,
        title: `${patientName} — ${serviceName}`,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          status,
          appointmentStatus: a.status,
          source: "native",
          description: `Servicio: ${serviceName}\nPaciente: ${patientName}${a.customerPhone ? `\nTel: ${a.customerPhone}` : ""}${a.notes ? `\nMotivo: ${a.notes}` : ""}${a.internalNotes ? `\nNotas Clínicas: ${a.internalNotes}` : ""}`,
          location: "Consultorio / Presencial",
          patientName,
          patientPhone: a.customerPhone,
          patientEmail: a.customerEmail || a.user?.email,
          service: serviceName,
          notes: a.notes,
          internalNotes: a.internalNotes,
          appointmentId: a.id,
        },
      };
    });
  } catch (err) {
    console.error("[calendar/events] Error fetching native appointments:", err);
  }

  // 2. Cargar eventos de Google Calendar o Microsoft si están conectados
  let externalEvents: any[] = [];
  const provider = await getConnectedProvider(tenantId, ["GOOGLE", "MICROSOFT"]);

  if (provider) {
    try {
      const accessToken = await getAppToken(tenantId, provider);
      if (accessToken) {
        if (provider === "GOOGLE") {
          // Events that mirror a native booking are already shown as native events.
          externalEvents = (await getGoogleEvents(accessToken, timeMin, timeMax)).filter(
            (e) => !linked.has(linkKey("GOOGLE", e.id))
          );
        } else {
          externalEvents = (await getMicrosoftEvents(accessToken, timeMin, timeMax)).filter(
            (e) => !linked.has(linkKey("MICROSOFT", e.id))
          );
        }
      }
    } catch (err) {
      console.warn("[calendar/events] Could not load external calendar events:", err);
    }
  }

  const allEvents = [...nativeEvents, ...externalEvents];
  const statuses = allEvents.map((e) => e.extendedProps?.status ?? "pending");

  return NextResponse.json({
    events: allEvents,
    hasExternalCalendar: !!provider,
    provider: provider ?? null,
    stats: {
      total: statuses.length,
      attended: statuses.filter((s) => s === "attended").length,
      cancelled: statuses.filter((s) => s === "cancelled").length,
      pending: statuses.filter((s) => s === "pending").length,
    },
  });
}

// ── Google Calendar Helper ──────────────────────────────────────────
async function getGoogleEvents(accessToken: string, timeMin: string, timeMax: string): Promise<any[]> {
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
    // calendarList not available — fallback to primary
  }

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

  return allItems.map((item: any) => {
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
      status = "pending"; color = "#6366f1"; // Indigo for Google Calendar events
    }

    return {
      id: item.id,
      title: `[Google] ${item.summary ?? "(sin título)"}`,
      start: startStr,
      end: isAllDay ? item.end?.date : item.end?.dateTime,
      allDay: isAllDay,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        status,
        source: "google",
        description: item.description ?? "",
        location: item.location ?? "",
        htmlLink: item.htmlLink ?? "",
        eventId: item.id,
        calendarId: item._calendarId,
        calendarOwnerEmail: primaryCalEmail,
      },
    };
  });
}

// ── Microsoft Calendar Helper ───────────────────────────────────────
async function getMicrosoftEvents(accessToken: string, timeMin: string, timeMax: string): Promise<any[]> {
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
      status = "pending"; color = "#0284c7"; // Sky blue for Outlook
    }

    return {
      id: item.id,
      title: `[Outlook] ${item.subject ?? "(sin título)"}`,
      start: startStr,
      end: endStr,
      allDay: isAllDay,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        status,
        source: "microsoft",
        description: item.bodyPreview ?? "",
        location: item.location?.displayName ?? "",
        htmlLink: item.webLink ?? "",
        eventId: item.id,
      },
    };
  });
}
