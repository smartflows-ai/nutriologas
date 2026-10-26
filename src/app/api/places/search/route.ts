// src/app/api/places/search/route.ts
// POST: address suggestions from Google Places. Public (sign-up has no session), rate limited per IP.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-errors";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  query: z.string().trim().min(3).max(120),
  sessionToken: z.string().trim().min(8).max(64),
  lang: z.enum(["es", "en"]).default("es"),
});

export async function POST(req: Request) {
  if (rateLimited(`places:${clientIp(req)}`, 40, 60_000)) return apiError("places_unavailable", 429);

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError("places_unavailable", 400);

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return apiError("places_unavailable", 503);

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: parsed.data.query,
        sessionToken: parsed.data.sessionToken,
        languageCode: parsed.data.lang,
      }),
    });
    if (!res.ok) return apiError("places_unavailable", 502);

    const data = await res.json();
    const suggestions = (data.suggestions ?? [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .slice(0, 5)
      .map((p: any) => ({ placeId: String(p.placeId), text: String(p.text?.text ?? "") }));
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[POST /api/places/search] Error:", error);
    return apiError("places_unavailable", 502);
  }
}
