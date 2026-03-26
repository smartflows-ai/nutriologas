// src/app/api/apps/oauth/google/callback/route.ts
// Handles Google OAuth callback: exchanges code → tokens, saves to DB.
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
    return NextResponse.redirect(new URL("/admin/apps?error=no_code", req.url));
  }

  // 1. Multi-tenant bounce: If we're on localhost but came from a subdomain,
  // immediately redirect to the subdomain's callback (cookies will be available there)
  if (stateParam) {
    const targetOrigin = stateParam;
    if (targetOrigin !== origin) {
      const redirectUrl = new URL(`${targetOrigin}/api/apps/oauth/google/callback`);
      redirectUrl.searchParams.set("code", code);
      redirectUrl.searchParams.set("original_uri", `${origin}/api/apps/oauth/google/callback`);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 2. Resolve redirect_uri (Google strictly demands the exact string used in step 1)
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const originalUri = url.searchParams.get("original_uri");
  const redirectUri = originalUri ?? `${baseUrl}/api/apps/oauth/google/callback`;

  // 3. Exchange code for tokens FIRST (before session check)
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/admin/apps?error=token_exchange", req.url));
  }

  const data = await tokenRes.json();

  // 4. Get user email from Google API using access token
  let userEmail: string | null = null;
  try {
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json();
      userEmail = userInfo.email ?? null;
    }
  } catch (e) {
  }

  // 5. Find user by email to get tenantId and userId
  // Try session fallback FIRST (more reliable for admin users)
  let sessionUserEmail: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      sessionUserEmail = (session.user as any).email;
    }
  } catch (err) {
  }
  
  // Use session email if available, otherwise use Google API email
  const finalEmail = sessionUserEmail || userEmail;
  
  if (!finalEmail) {
    return NextResponse.redirect(new URL("/admin/apps?error=no_email", req.url));
  }
  
  userEmail = finalEmail;

  // Look up user with tenant relationship included
  const user = await prisma.user.findFirst({
    where: { email: userEmail },
    include: { tenant: true },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/admin/apps?error=user_not_found", req.url));
  }

  // 6. Check if user is ADMIN
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/apps?error=not_admin", req.url));
  }

  // 7. Save the connection
  try {
    await saveAppConnection(user.tenantId, "GOOGLE", {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: data.scope ?? null,
    }, user.id);
  } catch (err) {
    throw err;
  }

  // 8. Redirect back to the correct tenant subdomain using DB info
  let host = "localhost:3000";
  if (user.tenant.customDomain) {
    host = user.tenant.customDomain;
  } else if (user.tenant.slug) {
    // If we're in prod, it might be slug.smartflows.com. For now we use standard suffix.
    const baseHost = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : "localhost:3000";
    if (baseHost.includes("localhost")) {
      host = `${user.tenant.slug}.localhost:3000`;
    } else {
      host = `${user.tenant.slug}.${baseHost.replace(/^www\./, '')}`;
    }
  }

  const protocol = process.env.NODE_ENV === "production" ? "https:" : new URL(req.url).protocol;
  const finalRedirectUrl = `${protocol}//${host}/admin/calendario?connected=google`;
  return NextResponse.redirect(finalRedirectUrl);
}