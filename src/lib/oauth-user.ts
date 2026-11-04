// src/lib/oauth-user.ts
// An email can exist in several tenants (a customer account created by a booking, plus the owner's admin account).
// The OAuth callbacks must connect the app to the signed-in user's tenant, never to whichever row comes first.

interface OAuthCandidate {
  id: string;
  role: string;
}

/** Signed-in user first; otherwise an ADMIN; otherwise the first candidate. */
export function pickOAuthUser<T extends OAuthCandidate>(candidates: readonly T[], sessionUserId: string | null): T | null {
  const fromSession = sessionUserId ? candidates.find((c) => c.id === sessionUserId) : undefined;
  return fromSession ?? candidates.find((c) => c.role === "ADMIN") ?? candidates[0] ?? null;
}
