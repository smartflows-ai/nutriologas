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

  // Handle cancel / error from Google (no code present)
  if (!code) {
    // Bounce back to the correct subdomain if we know it from state
    const cancelTarget = stateParam && stateParam !== origin
      ? `${stateParam}/admin/apps?error=cancelled`
      : `${origin}/admin/apps?error=cancelled`;
    return NextResponse.redirect(cancelTarget);
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
  const hostHeader = req.headers.get("host") || url.host || "";
  const isLocal = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1") || Boolean(stateParam && (stateParam.includes("localhost") || stateParam.includes("127.0.0.1")));
  const baseUrl = isLocal
    ? "http://localhost:3000"
    : (process.env.NEXTAUTH_URL ?? "https://newaigent.com");
  const redirectUri = `${baseUrl}/api/apps/oauth/google/callback`;

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

  // 8. Redirect back to the correct tenant subdomain
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
  const isProduction = process.env.NODE_ENV === "production";
  const protocol = isProduction ? "https" : "http";

  let finalOrigin: string;
  if (isLocal) {
    finalOrigin = `http://${user.tenant.slug}.localhost:3000`;
  } else if (user.tenant.customDomain) {
    const cleanDomain = user.tenant.customDomain.replace(/^https?:\/\//, "");
    finalOrigin = `${protocol}://${cleanDomain}`;
  } else {
    finalOrigin = `${protocol}://${user.tenant.slug}.${rootDomain}`;
  }

  const finalRedirectUrl = `${finalOrigin}/admin/calendario?connected=google`;
  return NextResponse.redirect(finalRedirectUrl);
}