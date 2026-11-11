// src/lib/home-after-sign-in.ts
// Client helper: where to send a user right after a credentials sign-in, from the role in the fresh session.
// A user with a temporary password goes to the change screen. ADMIN goes to the dashboard, STAFF to the /admin entry (it resolves the section), anyone else to the store.
import { CHANGE_PASSWORD_PATH } from "@/lib/account-state";
import { roleHomePath } from "@/lib/permissions";

const SESSION_ENDPOINT = "/api/auth/session";

export async function homeAfterSignIn(): Promise<string> {
  try {
    const res = await fetch(SESSION_ENDPOINT);
    const data: unknown = await res.json();
    // A temporary password: the only screen that opens is the one to choose a new one (ticket #22).
    if ((data as { mustChangePassword?: unknown } | null)?.mustChangePassword === true) return CHANGE_PASSWORD_PATH;
    const role = (data as { user?: { role?: unknown } } | null)?.user?.role;
    return roleHomePath(typeof role === "string" ? role : null);
  } catch {
    return roleHomePath(null);
  }
}
