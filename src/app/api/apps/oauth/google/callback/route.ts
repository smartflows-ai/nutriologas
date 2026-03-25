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

  console.log("[GOOGLE-CALLBACK] === INICIO ===");
  console.log("[GOOGLE-CALLBACK] Code:", code ? "YES" : "NO");
  console.log("[GOOGLE-CALLBACK] State:", stateParam);
  console.log("[GOOGLE-CALLBACK] Origin:", origin);

  if (!code) {
    console.error("[GOOGLE-CALLBACK] ERROR: No code received");
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
  console.log("[GOOGLE-CALLBACK] Step 3: Exchanging code for tokens...");
  console.log("[GOOGLE-CALLBACK] Client ID:", process.env.GOOGLE_CLIENT_ID ? "SET" : "MISSING");
  console.log("[GOOGLE-CALLBACK] Client Secret:", process.env.GOOGLE_CLIENT_SECRET ? "SET" : "MISSING");
  console.log("[GOOGLE-CALLBACK] Redirect URI:", redirectUri);
  
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
    const errorText = await tokenRes.text();
    console.error("[GOOGLE-CALLBACK] Token exchange FAILED:", errorText);
    return NextResponse.redirect(new URL("/admin/apps?error=token_exchange", req.url));
  }

  const data = await tokenRes.json();
  console.log("[GOOGLE-CALLBACK] Token exchange SUCCESS");
  console.log("[GOOGLE-CALLBACK] Access token:", data.access_token ? "YES" : "NO");
  console.log("[GOOGLE-CALLBACK] Refresh token:", data.refresh_token ? "YES" : "NO");
  console.log("[GOOGLE-CALLBACK] ID token:", data.id_token ? "YES" : "NO");

  // 4. Get user email from Google API using access token
  let userEmail: string | null = null;
  try {
    console.log("[GOOGLE-CALLBACK] Step 4: Fetching user info from Google API...");
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json();
      userEmail = userInfo.email ?? null;
      console.log("[GOOGLE-CALLBACK] User info response:", {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
      });
    } else {
      console.error("[GOOGLE-CALLBACK] User info API failed:", await userInfoRes.text());
    }
  } catch (e) {
    console.error("[GOOGLE-CALLBACK] Failed to fetch user info:", e);
  }

  // 5. Find user by email to get tenantId and userId
  console.log("[GOOGLE-CALLBACK] Step 5: Looking up user...");
  console.log("[GOOGLE-CALLBACK] User email from token:", userEmail);
  
  // Try session fallback FIRST (more reliable for admin users)
  let sessionUserEmail: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      sessionUserEmail = (session.user as any).email;
      console.log("[GOOGLE-CALLBACK] Session found - email:", sessionUserEmail);
      console.log("[GOOGLE-CALLBACK] Session user details:", {
        id: (session.user as any).id,
        role: (session.user as any).role,
        tenantId: (session.user as any).tenantId
      });
    } else {
      console.log("[GOOGLE-CALLBACK] No session found");
    }
  } catch (err) {
    console.error("[GOOGLE-CALLBACK] Session lookup failed:", err);
  }
  
  // Use session email if available, otherwise use Google API email
  const finalEmail = sessionUserEmail || userEmail;
  
  if (!finalEmail) {
    console.error("[GOOGLE-CALLBACK] ERROR: No email available from session or Google API");
    console.error("[GOOGLE-CALLBACK]   - sessionUserEmail:", sessionUserEmail);
    console.error("[GOOGLE-CALLBACK]   - userEmail (from Google):", userEmail);
    return NextResponse.redirect(new URL("/admin/apps?error=no_email", req.url));
  }
  
  userEmail = finalEmail;
  console.log("[GOOGLE-CALLBACK] Using email:", userEmail);

  // Look up user with tenant relationship included
  console.log("[GOOGLE-CALLBACK] Looking up user in DB:", userEmail);
  const user = await prisma.user.findFirst({
    where: { email: userEmail },
    include: { tenant: true },
  });

  console.log("[GOOGLE-CALLBACK] User lookup result:", user ? "FOUND" : "NOT FOUND");
  
  if (!user) {
    console.error("[GOOGLE-CALLBACK] ERROR: User not found for email:", userEmail);
    return NextResponse.redirect(new URL("/admin/apps?error=user_not_found", req.url));
  }

  console.log("[GOOGLE-CALLBACK] User details:");
  console.log("[GOOGLE-CALLBACK]   - ID:", user.id);
  console.log("[GOOGLE-CALLBACK]   - Tenant ID:", user.tenantId);
  console.log("[GOOGLE-CALLBACK]   - Tenant name:", user.tenant.name);
  console.log("[GOOGLE-CALLBACK]   - Role:", user.role);

  // 6. Check if user is ADMIN
  if (user.role !== "ADMIN") {
    console.error("[GOOGLE-CALLBACK] ERROR: User is not ADMIN, role is:", user.role);
    return NextResponse.redirect(new URL("/admin/apps?error=not_admin", req.url));
  }

  // 7. Save the connection
  console.log("[GOOGLE-CALLBACK] Step 7: Calling saveAppConnection...");
  console.log("[GOOGLE-CALLBACK]   - tenantId:", user.tenantId);
  console.log("[GOOGLE-CALLBACK]   - provider: GOOGLE");
  console.log("[GOOGLE-CALLBACK]   - userId:", user.id);
  
  try {
    await saveAppConnection(user.tenantId, "GOOGLE", {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: data.scope ?? null,
    }, user.id);
    console.log("[GOOGLE-CALLBACK] saveAppConnection SUCCESS");
  } catch (err) {
    console.error("[GOOGLE-CALLBACK] saveAppConnection FAILED:", err);
    throw err;
  }

  // 8. Redirect back to the correct tenant subdomain using DB info
  console.log("[GOOGLE-CALLBACK] Step 8: Redirecting to tenant subdomain");
  
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
  
  console.log("[GOOGLE-CALLBACK] Final redirect URL:", finalRedirectUrl);
  return NextResponse.redirect(finalRedirectUrl);
}