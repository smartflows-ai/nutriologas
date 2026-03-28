// src/app/api/apps/oauth/facebook/start/route.ts
// Initiates Facebook OAuth flow to connect a Page for the tenant.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const appId = process.env.FACEBOOK_APP_ID ?? "";
  if (!appId) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID no configurado." }, { status: 500 });
  }

  // ── Fixed registered redirect_uri (must match Meta App dashboard exactly) ──
  // Register only ONE URI: http://localhost:3000/api/apps/oauth/facebook/callback
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/apps/oauth/facebook/callback`;

  // ── Capture the subdomain origin so the callback can bounce back to it ──
  // e.g. http://doctor.localhost:3000 — same pattern as Google
  const subdomainOrigin = new URL(req.url).origin;

  const scopes = ["email", "pages_show_list", "pages_manage_posts", "pages_read_engagement"].join(",");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", subdomainOrigin); // used in callback to bounce

  return NextResponse.redirect(authUrl.toString());
}
