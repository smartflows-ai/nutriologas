// src/app/api/calendar/connect/route.ts
// Initiates a custom Google Calendar OAuth flow.
// We bypass NextAuth's signIn because the admin's credentials-email (admin@nutri.com)
// differs from their Google email (yankees00000@gmail.com). NextAuth would create
// a new user instead of updating the real admin's token.
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(req: NextRequest) {
  // Verify the user is an authenticated admin
  const token = await getToken({ req });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${base}/api/calendar/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    // Pass the admin's user ID in state so we can identify them on callback
    state: (token as any).sub ?? (token as any).id ?? "",
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
