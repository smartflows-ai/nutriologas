// src/middleware.ts
// Next.js only reads the middleware from src/ when the app lives in src/app;
// the old root middleware.ts never ran. The matcher is limited to /admin on purpose: root-domain blocking
// (its list included /admin, /login, /registro, /recuperar, /checkout, /carrito, /pedido, /mis-pedidos,
// /productos and /producto), the checkout login and the /login redirect are a separate ticket, so nothing
// else changes behavior here.
// APIs are not covered: each API route checks its own permission (src/lib/permission-guard.ts).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessAdminPath, isCrmRole } from "@/lib/permissions";

const LOGIN_PATH = "/login";
const ADMIN_ENTRY = "/admin";

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  // Same cookie choice as src/lib/auth.ts, so a local https NEXTAUTH_URL never hides the dev cookie.
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  const role = typeof token?.role === "string" ? token.role : null;

  // No session or a role outside the CRM: login, as the admin layout already did.
  if (!token || !isCrmRole(role)) return NextResponse.redirect(new URL(LOGIN_PATH, nextUrl));

  // STAFF outside its sections goes to the /admin entry, which sends it to its home page.
  if (!canAccessAdminPath(role, nextUrl.pathname)) return NextResponse.redirect(new URL(ADMIN_ENTRY, nextUrl));

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
