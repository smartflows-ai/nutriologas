// src/app/api/apps/oauth/facebook/callback/route.ts
// Handles Facebook OAuth callback.
// Token exchange runs on base localhost:3000 (matches registered redirect_uri).
// Error + success redirects go to the correct tenant subdomain via stateParam or DB slug.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state"); // subdomain origin from start route
  const errorParam = url.searchParams.get("error");

  // Helper: redirect to the subdomain (or fallback to base) for error/success pages
  const subdomainRedirect = (path: string) => {
    // If stateParam is available (e.g. http://doctor.localhost:3000), use it.
    // Otherwise fallback to base domain for error display.
    const base = stateParam?.split('#')[0] ?? url.origin;
    return NextResponse.redirect(`${base}${path}`);
  };

  if (errorParam || !code) {
    const msg = url.searchParams.get("error_description") ?? "Autorización cancelada";
    return subdomainRedirect(`/admin/social-campaign?error=${encodeURIComponent(msg)}`);
  }

  // redirect_uri MUST exactly match NEXTAUTH_URL-based URI registered in Meta App
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/apps/oauth/facebook/callback`;

  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;

  // ── 1. Exchange code → short-lived user token ──────────────────────────────
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
    `client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${appSecret}&code=${code}`
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    console.error("[Facebook Callback] Token error:", tokenData.error);
    return subdomainRedirect(`/admin/apps?error=${encodeURIComponent(tokenData.error.message)}`);
  }
  const userToken: string = tokenData.access_token;

  // ── 2. Exchange → long-lived user token ────────────────────────────────────
  const longRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
    `grant_type=fb_exchange_token&client_id=${appId}` +
    `&client_secret=${appSecret}&fb_exchange_token=${userToken}`
  );
  const longData = await longRes.json();
  if (longData.error) {
    return subdomainRedirect(`/admin/apps?error=${encodeURIComponent(longData.error.message)}`);
  }
  const longUserToken: string = longData.access_token;

  // ── 3. Get user email — try session first, then Facebook /me ───────────────
  // Session is available if the callback lands on the same domain as login (rare on base domain)
  let userEmail: string | null = null;

  try {
    const session = await getServerSession(authOptions);
    userEmail = (session?.user as any)?.email ?? null;
  } catch (_) {}

  // Facebook /me returns email when 'email' scope was requested in start route
  if (!userEmail) {
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=email&access_token=${longUserToken}`
    );
    const meData = await meRes.json();
    userEmail = meData.email ?? null;
  }

  if (!userEmail) {
    return subdomainRedirect("/admin/apps?error=no_email");
  }

  // ── 4. Look up user + tenant in DB ────────────────────────────────────────
  const user = await prisma.user.findFirst({
    where: { email: userEmail },
    include: { tenant: true },
  });

  if (!user || user.role !== "ADMIN") {
    return subdomainRedirect("/admin/apps?error=user_not_found");
  }

  // ── 5. Get managed pages ───────────────────────────────────────────────────
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${longUserToken}`
  );
  const pagesData = await pagesRes.json();
  if (pagesData.error) {
    return subdomainRedirect(`/admin/apps?error=${encodeURIComponent(pagesData.error.message)}`);
  }

  const pages: Array<{ id: string; name: string; access_token: string }> =
    pagesData.data ?? [];

  if (pages.length === 0) {
    return subdomainRedirect("/admin/apps?error=no_pages");
  }

  const page = pages[0];

  // ── 6. Fetch linked Instagram Business Account (same token, same page) ────
  // If the Facebook Page has a linked IG Business Account, store its ID in metadata.
  // The Instagram Graph API accepts the same Facebook Page Access Token.
  let igBusinessAccountId: string | null = null;
  try {
    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    );
    const igData = await igRes.json();
    igBusinessAccountId = igData.instagram_business_account?.id ?? null;
  } catch (_) {}

  // ── 7. Upsert ConnectedApp ─────────────────────────────────────────────────
  const metadata = {
    pageId: page.id,
    pageName: page.name,
    allPages: pages.map((p) => ({ id: p.id, name: p.name })),
    ...(igBusinessAccountId ? { igBusinessAccountId } : {}),
  };

  await prisma.connectedApp.upsert({
    where: { tenantId_provider: { tenantId: user.tenantId, provider: "FACEBOOK" } },
    update: {
      accessToken: page.access_token,
      connectedByUserId: user.id,
      metadata,
    },
    create: {
      tenantId: user.tenantId,
      provider: "FACEBOOK",
      accessToken: page.access_token,
      connectedByUserId: user.id,
      metadata,
    },
  });

  // ── 7. Redirect to tenant subdomain ───────────────────────────────────────
  // Prefer stateParam (set by start route). Fall back to building from tenant slug.
  let finalOrigin = stateParam?.split('#')[0]; // strip FB fragment if present

  if (!finalOrigin) {
    const fallbackHost = req.headers.get("host") || "localhost:3000";
    const baseHost = process.env.NEXTAUTH_URL
      ? new URL(process.env.NEXTAUTH_URL).host
      : fallbackHost;
    const protocol = process.env.NODE_ENV === "production" || !baseHost.includes("localhost") ? "https:" : "http:";

    if (user.tenant.customDomain) {
      finalOrigin = `${protocol}//${user.tenant.customDomain}`;
    } else if (baseHost.includes("localhost")) {
      finalOrigin = `http://${user.tenant.slug}.${baseHost}`;
    } else {
      finalOrigin = `${protocol}//${user.tenant.slug}.${baseHost.replace(/^www\./, "")}`;
    }
  }

  return NextResponse.redirect(`${finalOrigin}/admin/social-campaign?connected=facebook`);
}
