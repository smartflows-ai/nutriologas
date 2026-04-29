// src/lib/session.ts
// Reads the NextAuth JWT directly from the session cookie and decodes it.
// Avoids getServerSession() which fails in App Router RSCs with custom cookie config.
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";

export interface AppSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    tenantId: string;
  };
}

export async function getAppSession(): Promise<AppSession | null> {
  const cookieStore = cookies();

  const useSecureCookies = process.env.NODE_ENV === "production";
  const cookieName = useSecureCookies
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const sessionToken = cookieStore.get(cookieName)?.value;
  if (!sessionToken) return null;

  try {
    const token = await decode({
      token: sessionToken,
      secret: process.env.NEXTAUTH_SECRET!,
    });

    if (!token || !token.id || !token.tenantId) return null;

    return {
      user: {
        id: token.id as string,
        email: token.email as string,
        name: (token.name as string | null) ?? null,
        role: token.role as string,
        tenantId: token.tenantId as string,
      },
    };
  } catch {
    return null;
  }
}
