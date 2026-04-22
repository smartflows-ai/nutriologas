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
  const token = await getToken({ req });
  const isLoggedIn = !!token;
  const isAdmin = token?.role === "ADMIN";

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isAuthRoute = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/registro");
  const isCheckoutRoute = nextUrl.pathname.startsWith("/checkout");
  const isOrderRoute = nextUrl.pathname.startsWith("/pedido/") || nextUrl.pathname.startsWith("/mis-pedidos");

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

  // Insertar cabeceras personalizadas de manera nativa sin el envoltorio destructivo de NextAuth
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-slug", tenantIdentifier);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api/auth|api/internal|api/apps|api/calendar|_next/static|_next/image|favicon.ico|public).*)"],
};
