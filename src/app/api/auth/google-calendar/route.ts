import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const callbackUrl = url.searchParams.get("callbackUrl") ?? "/admin/calendario";

  // Redirect into NextAuth's built-in signin route for the dedicated provider.
  const signin = new URL("/api/auth/signin/google-calendar", url.origin);
  signin.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(signin);
}

