// src/app/api/apps/oauth/microsoft/start/route.ts
// Initiates Microsoft OAuth flow with Calendar + Mail scopes (Outlook).
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  const origin = new URL(req.url).origin;
  // Use the current request origin instead of NEXTAUTH_URL to support subdomain routing
  const redirectUri = `${origin}/api/apps/oauth/microsoft/callback`;

  const scopes = "Calendars.Read Mail.Read offline_access";

  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
  );
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("prompt", "consent");
  
  // Pass the current origin in state to bounce back correctly
  authUrl.searchParams.set("state", origin);

  if (session.user?.email) {
    authUrl.searchParams.set("login_hint", session.user.email);
  }

  return NextResponse.redirect(authUrl.toString());
}
