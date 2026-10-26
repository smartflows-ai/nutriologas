// src/app/api/places/details/route.ts
// POST: address and coordinates for one Google Place. Public, rate limited per IP.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-errors";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  placeId: z.string().trim().min(5).max(300),
  sessionToken: z.string().trim().min(8).max(64),
  lang: z.enum(["es", "en"]).default("es"),
});

export async function POST(req: Request) {
  if (rateLimited(`places:${clientIp(req)}`, 40, 60_000)) return apiError("places_unavailable", 429);

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError("place_not_found", 400);

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return apiError("places_unavailable", 503);

  try {
    const { placeId, sessionToken, lang } = parsed.data;
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}&languageCode=${lang}`;
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,formattedAddress,location" },
    });
    if (res.status === 404) return apiError("place_not_found", 404);
    if (!res.ok) return apiError("places_unavailable", 502);

    const data = await res.json();
    if (!data.formattedAddress) return apiError("place_not_found", 404);
    return NextResponse.json({
      address: String(data.formattedAddress),
      placeId: String(data.id ?? placeId),
      latitude: typeof data.location?.latitude === "number" ? data.location.latitude : null,
      longitude: typeof data.location?.longitude === "number" ? data.location.longitude : null,
    });
  } catch (error) {
    console.error("[POST /api/places/details] Error:", error);
    return apiError("places_unavailable", 502);
  }
}
