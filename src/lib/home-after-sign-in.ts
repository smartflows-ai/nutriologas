// src/lib/home-after-sign-in.ts
// Client helper: where to send a user right after a credentials sign-in, from the role in the fresh session.
// ADMIN goes to the dashboard, STAFF to the /admin entry (it resolves the section), anyone else to the store.
import { roleHomePath } from "@/lib/permissions";

const SESSION_ENDPOINT = "/api/auth/session";

export async function homeAfterSignIn(): Promise<string> {
  try {
    const res = await fetch(SESSION_ENDPOINT);
    const data: unknown = await res.json();
    const role = (data as { user?: { role?: unknown } } | null)?.user?.role;
    return roleHomePath(typeof role === "string" ? role : null);
  } catch {
    return roleHomePath(null);
  }
}
