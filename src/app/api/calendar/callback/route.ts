// src/app/api/calendar/callback/route.ts
// Receives the code from Google after the admin grants Calendar access.
// Exchanges it for tokens and saves to the REAL admin's DB record (identified via state).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state"); // this is the admin's user ID
  const error = searchParams.get("error");

  if (error || !code || !state) {
    console.error("[calendar/callback] Error from Google:", error);
    return NextResponse.redirect(`${base}/admin/calendario?error=calendar_denied`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: `${base}/api/calendar/callback`,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[calendar/callback] Token exchange failed:", err);
      return NextResponse.redirect(`${base}/admin/calendario?error=token_exchange`);
    }

    const tokens = await tokenRes.json();

    // Save token to the admin identified by the state (their user ID)
    await prisma.user.update({
      where: { id: state },
      data: {
        googleCalendarToken: tokens.access_token ?? null,
        googleCalendarRefreshToken: tokens.refresh_token ?? null,
        googleCalendarTokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      },
    });

    console.log("[calendar/callback] Token saved for user:", state);
    return NextResponse.redirect(`${base}/admin/calendario?connected=true`);
  } catch (err) {
    console.error("[calendar/callback] Unexpected error:", err);
    return NextResponse.redirect(`${base}/admin/calendario?error=unknown`);
  }
}
