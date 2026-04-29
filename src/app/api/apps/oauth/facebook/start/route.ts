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

  const hostHeader = req.headers.get("host") || new URL(req.url).host;
  const baseUrlFallback = hostHeader.includes("localhost") ? `http://${hostHeader}` : `https://${hostHeader}`;
  const baseUrl = process.env.NEXTAUTH_URL ?? baseUrlFallback;
  const redirectUri = `${baseUrl}/api/apps/oauth/facebook/callback`;

  // ── Capture the subdomain origin from the Host header ──────────────────────
  // IMPORTANT: req.url always returns the base domain (localhost:3000) in Next.js.
  // We must read the actual Host header the browser sent to get the subdomain.
  // e.g. Host: "doctor.localhost:3000" → http://doctor.localhost:3000
  const host = req.headers.get("host") || new URL(req.url).host;
  const protocol = host.includes("localhost") ? "http" : "https";
  const subdomainOrigin = `${protocol}://${host}`;

  const scopes = [
    "email",
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
  ].join(",");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", subdomainOrigin); // used in callback to bounce back to tenant subdomain

  return NextResponse.redirect(authUrl.toString());
}
