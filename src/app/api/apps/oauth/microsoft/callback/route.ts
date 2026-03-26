// src/app/api/apps/oauth/microsoft/callback/route.ts
// Handles Microsoft OAuth callback: exchanges code → tokens, saves to DB.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveAppConnection } from "@/lib/connected-apps";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const origin = url.origin;

  if (!code) {
    const error = url.searchParams.get("error_description") ?? "no_code";
    return NextResponse.redirect(new URL(`/admin/apps?error=${encodeURIComponent(error)}`, req.url));
  }

  // 1. Multi-tenant bounce
  if (stateParam) {
    const targetOrigin = stateParam;
    if (targetOrigin !== origin) {
      const redirectUrl = new URL(`${targetOrigin}/api/apps/oauth/microsoft/callback`);
      redirectUrl.searchParams.set("code", code);
      redirectUrl.searchParams.set("original_uri", `${origin}/api/apps/oauth/microsoft/callback`);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 2. Resolve redirect_uri (Microsoft strictly demands the exact string used in step 1)
  const msTenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const originalUri = url.searchParams.get("original_uri");
  const redirectUri = originalUri ?? `${baseUrl}/api/apps/oauth/microsoft/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "Calendars.Read Mail.Read offline_access",
      }).toString(),
    }
  );

  if (!tokenRes.ok) {
    console.error("[microsoft-callback] Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(new URL("/admin/apps?error=token_exchange", req.url));
  }

  const data = await tokenRes.json();

  // 3. Decode the ID token to get the user's email (base64url format)
  let userEmail: string | null = null;
  if (data.id_token) {
    try {
      const parts = data.id_token.split('.');
      const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
      const decoded = JSON.parse(payload) as { preferred_username?: string; email?: string };
      userEmail = decoded.preferred_username ?? decoded.email ?? null;
    } catch (e) {
      console.error("[microsoft-callback] Failed to decode id_token:", e);
    }
  }

  // 4. Find user by email to get tenantId and userId
  if (!userEmail) {
    // Fallback to session if we couldn't get email from token
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    userEmail = (session.user as any).email;
  }

  if (!userEmail) {
    return NextResponse.redirect(new URL("/admin/apps?error=no_email", req.url));
  }

  const user = await prisma.user.findFirst({
    where: { email: userEmail },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/admin/apps?error=user_not_found", req.url));
  }

  // 5. Check if user is ADMIN
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/apps?error=not_admin", req.url));
  }

  // 6. Save the connection
  await saveAppConnection(user.tenantId, "MICROSOFT", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    scopes: data.scope ?? null,
  }, user.id);

  // 7. Redirect back to the page the user was on (admin/apps)
  const finalRedirectOrigin = stateParam && !stateParam.includes('localhost') ? stateParam : origin;
  return NextResponse.redirect(new URL("/admin/calendario?connected=microsoft", finalRedirectOrigin));
}
