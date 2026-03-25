// src/app/api/apps/oauth/google/start/route.ts
// Initiates Google OAuth flow with Calendar + Sheets scopes.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  
  // Get the full URL including host (for subdomain support)
  const fullUrl = new URL(req.url);
  const origin = fullUrl.origin;
  const host = fullUrl.host; // Includes subdomain if present
  
  // Use dynamic origin to support multi-tenant subdomains
  // IMPORTANT: Register this pattern in Google Cloud Console:
  // - http://localhost:3000/api/apps/oauth/google/callback
  // - https://*.nutri.localhost/api/apps/oauth/google/callback
  // - https://yourdomain.com/api/apps/oauth/google/callback
  const redirectUri = `${origin}/api/apps/oauth/google/callback`;

  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  // Pass the full URL (with subdomain) in state to bounce back correctly
  authUrl.searchParams.set("state", origin);
  authUrl.searchParams.set("hd_host", host);

  // Force Google to use this specific email
  if (session.user?.email) {
    authUrl.searchParams.set("login_hint", session.user.email);
    authUrl.searchParams.set("hd", session.user.email.split("@")[1] || "");
  }

  return NextResponse.redirect(authUrl.toString());
}