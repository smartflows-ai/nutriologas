import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const callbackUrl = url.searchParams.get("callbackUrl") ?? "/admin/calendario";

  // IMPORTANT: Always use NEXTAUTH_URL as the base, NOT url.origin.
  // When visited from a subdomain (e.g. nutri.localhost:3000), url.origin
  // would be "http://nutri.localhost:3000" which NextAuth rejects because
  // it doesn't match NEXTAUTH_URL. This caused the redirect to /login.
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const signin = new URL("/api/auth/signin/google-calendar", base);
  signin.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(signin);
}
