// src/app/api/internal/calendar/availability/route.ts
// Called by n8n to check calendar availability using the tenant's own Google credentials.
import { NextRequest } from "next/server";
import { getAppToken } from "@/lib/connected-apps";
import { findAvailableSlots } from "@/lib/google-calendar";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (key !== process.env.INTERNAL_API_KEY) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { tenantId, date, duration, timePreference } = body;

  if (!tenantId || !date || !duration) {
    return Response.json(
      { success: false, error: "Missing required fields: tenantId, date, duration" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { success: false, error: "Invalid date format. Use YYYY-MM-DD" },
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

  try {
    const result = await findAvailableSlots(
      accessToken,
      date,
      Number(duration),
      timePreference || "any"
    );
    return Response.json(result);
  } catch (err: any) {
    console.error("[internal/calendar/availability] Error:", err);
    return Response.json(
      { success: false, error: err.message || "Error checking availability" },
      { status: 500 }
    );
  }
}
