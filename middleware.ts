// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const hostname = req.headers.get("host") || "";
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com").toLowerCase();

  let tenantIdentifier = "";

  // Lógica de detección de dominios
  if (hostname === `localhost:3000` || hostname === rootDomain || hostname === `www.${rootDomain}`) {
    tenantIdentifier = ""; // Root domain -> NeoAigent Marketing Page
  } else if (hostname.endsWith(".localhost:3000")) {
    tenantIdentifier = hostname.replace(".localhost:3000", "");
  } else if (hostname.endsWith(`.${rootDomain}`)) {
    tenantIdentifier = hostname.replace(`.${rootDomain}`, "");
  } else {
    tenantIdentifier = hostname; // Custom domain (e.g. myclinic.com)
  }

  // Extraer token de sesion crudo desde Edge
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token;
  const isAdmin = token?.role === "ADMIN";

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isAuthRoute = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/registro");
  const isCheckoutRoute = nextUrl.pathname.startsWith("/checkout");
  const isOrderRoute = nextUrl.pathname.startsWith("/pedido/") || nextUrl.pathname.startsWith("/mis-pedidos");

  // On the root domain, only the marketing page (/) is allowed.
  // All tenant-specific routes return 404 — they belong on subdomains only.
  const isRootDomain = tenantIdentifier === "";
  const ROOT_BLOCKED_PREFIXES = [
    "/admin",
    "/login",
    "/registro",
    "/checkout",
    "/carrito",
    "/pedido",
    "/mis-pedidos",
    "/productos",
    "/producto",
  ];
  if (isRootDomain && ROOT_BLOCKED_PREFIXES.some((p) => nextUrl.pathname.startsWith(p))) {
    return NextResponse.rewrite(new URL("/_not-found", req.url));
  }

  // Rutas /admin/* — solo admins
  if (isAdminRoute) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", nextUrl));
    if (!isAdmin) return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Checkout y pedidos — requiere login
  if ((isCheckoutRoute || isOrderRoute) && !isLoggedIn) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl));
  }

  // Si ya esta logueado no puede ir a login/registro
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL(isAdmin ? "/admin/dashboard" : "/", nextUrl));
  }

  const requestHeaders = new Headers(req.headers);
  // Quitar cualquier header x-session-user que venga del cliente (prevenir spoofing)
  requestHeaders.delete("x-session-user");
  requestHeaders.set("x-tenant-slug", tenantIdentifier);

  // Pasar los datos de sesión al servidor via header (getToken ya funciona en middleware)
  if (token) {
    requestHeaders.set("x-session-user", JSON.stringify({
      id: token.id,
      email: token.email,
      name: token.name ?? null,
      role: token.role,
      tenantId: token.tenantId,
    }));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api/auth|api/internal|api/apps|api/calendar|_next/static|_next/image|favicon.ico|public).*)"],
};
