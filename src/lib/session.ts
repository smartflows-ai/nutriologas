// src/lib/session.ts
// Reads the NextAuth JWT directly from the session cookie and decodes it.
// Avoids getServerSession() which fails in App Router RSCs with custom cookie config.
// The token only says who the user is. Whether they still have access, and with which role, comes from the
// account row on every request (ticket #22, src/lib/account-state.ts).
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { readAccountAccess } from "@/lib/account-state-data";
import { checkRequestHost } from "@/lib/tenant-host-guard-data";

export interface AppSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    tenantId: string;
  };
}

export interface SessionIdentity {
  id: string;
  tenantId: string;
}

export type SessionAccess =
  | { kind: "none" }
  // A valid session that arrived on the host of ANOTHER business (the cookie is shared by every subdomain,
  // ticket #146). It is not usable here: pages treat it as signed out; the CRM sends it to its own business.
  | { kind: "other_business"; homeUrl: string | null }
  // Signed in with a temporary password: only the change-password screen and its API may use this identity.
  | { kind: "password_change"; identity: SessionIdentity }
  | { kind: "active"; session: AppSession };

// The session for normal use: null unless the account is active and owes no password change.
export async function getAppSession(): Promise<AppSession | null> {
  const access = await getSessionAccess();
  return access.kind === "active" ? access.session : null;
}

export async function getSessionAccess(): Promise<SessionAccess> {
  const token = await readSessionToken();
  if (!token) return { kind: "none" };

  const access = await readAccountAccess(token.user.tenantId, token.user.id, token.sessionVersion);
  if (access.kind === "none") return { kind: "none" };
  const host = await checkRequestHost(token.user.tenantId);
  if (host.kind === "other_business") return { kind: "other_business", homeUrl: host.homeUrl };
  if (access.kind === "password_change") {
    return { kind: "password_change", identity: { id: token.user.id, tenantId: token.user.tenantId } };
  }
  // The role comes from the database, not from the token.
  return { kind: "active", session: { user: { ...token.user, role: access.role } } };
}

interface SessionToken extends AppSession {
  // The account version this session was issued for; undefined in tokens from before versions existed.
  sessionVersion: number | undefined;
}

// Decodes the cookie. It proves identity only; it does not prove the account still has access.
async function readSessionToken(): Promise<SessionToken | null> {
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
      sessionVersion: typeof token.sessionVersion === "number" ? token.sessionVersion : undefined,
    };
  } catch {
    return null;
  }
}
