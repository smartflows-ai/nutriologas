// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth((req: NextRequest) => {
  const { nextUrl } = req;
  const token = (req as any).nextauth?.token;
  const isLoggedIn = !!token;
  const isAdmin = token?.role === "ADMIN";

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isAuthRoute = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/registro");
  const isCheckoutRoute = nextUrl.pathname.startsWith("/checkout");

  // Rutas /admin/* — solo admins
  if (isAdminRoute) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login?callbackUrl=/admin/dashboard", nextUrl));
    if (!isAdmin) return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Checkout — requiere login
  if (isCheckoutRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/checkout", nextUrl));
  }

  // Si ya esta logueado no puede ir a login/registro
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL(isAdmin ? "/admin/dashboard" : "/", nextUrl));
  }

  return NextResponse.next();
}, {
  // Dejamos pasar y aplicamos redirecciones nosotros
  callbacks: { authorized: () => true },
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};
