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

  // Get the real host from headers (req.url may not include subdomain)
  const hostHeader = req.headers.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = `${protocol}://${hostHeader}`;
  const host = hostHeader;

  // Google OAuth requires a FIXED redirect_uri registered in Cloud Console.
  // We always use the base domain (localhost:3000) as the redirect_uri,
  // and use the state parameter to bounce back to the correct subdomain.
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/apps/oauth/google/callback`;

  const scopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send",
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