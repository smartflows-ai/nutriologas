// src/lib/account-state.ts
// What a signed-in user may do right now, from the account row read on each request (ticket #22).
// The session token lives 30 days, so the token alone cannot say a user was deactivated or changed role.
// Pure module: no I/O, shared by every place that reads a session (tests in tests/account-state.test.ts).

export interface AccountState {
  readonly role: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  // Goes up when the owner resets the password or deactivates the account, and on a WhatsApp reset.
  readonly sessionVersion: number;
}

// A session issued before versions existed carries none: it counts as the starting version.
export const INITIAL_SESSION_VERSION = 0;

export type AccountAccess =
  // Deleted or deactivated: no session at all.
  | { readonly kind: "none" }
  // Temporary password: the only thing the user may do is choose their own.
  | { readonly kind: "password_change" }
  // Normal access, with the role the database has now.
  | { readonly kind: "active"; readonly role: string };

// `state` is null when the user no longer exists in that business.
// `tokenSessionVersion` is the version the session was issued for. A different one means the password was
// reset or the account was deactivated after that sign-in: that session is over for good, so a stolen cookie
// does not come back to life when the user chooses a new password or the account is activated again.
export function resolveAccountAccess(
  state: AccountState | null,
  tokenSessionVersion: number = INITIAL_SESSION_VERSION
): AccountAccess {
  if (!state || !state.isActive) return { kind: "none" };
  if (state.sessionVersion !== tokenSessionVersion) return { kind: "none" };
  if (state.mustChangePassword) return { kind: "password_change" };
  return { kind: "active", role: state.role };
}

export type AccessKind = AccountAccess["kind"];

// Where a user with a temporary password is sent, and the only page that user may open.
export const CHANGE_PASSWORD_PATH = "/cambiar-contrasena";

export interface LockedSession {
  readonly expires: string;
  readonly mustChangePassword?: true;
}

// The session a route receives. Anything but "active" gets a session with NO `user`: the routes guard with
// `!session?.user`, so they all answer 401. Leaving `user` with empty fields instead would be dangerous: Prisma
// ignores a filter whose value is undefined, and a route would read every business's rows.
// A token with no decision yet (`undefined`) is treated as no access.
export function sessionForAccess<S extends { readonly expires: string }>(session: S, kind: AccessKind | undefined): S | LockedSession {
  if (kind === "active") return session;
  if (kind === "password_change") return { expires: session.expires, mustChangePassword: true };
  return { expires: session.expires };
}

// Google sign-in is for owners and customers. Staff sign in with email and password only (ticket #22),
// and a deactivated account of any role is refused. `account` is null for a new customer.
export function googleSignInAllowed(account: Pick<AccountState, "role" | "isActive"> | null): boolean {
  if (!account) return true;
  return account.isActive && account.role !== "STAFF";
}

export const LOGIN_PATH = "/login";

// Where a browser must go when the session it holds is no longer usable, from the body of /api/auth/session.
// null means the session is fine. Used by the CRM's session watch (src/components/admin/SessionWatch.tsx).
export function lockedDestination(snapshot: Readonly<Record<string, unknown>> | null | undefined): string | null {
  if (snapshot?.user) return null;
  return snapshot?.mustChangePassword === true ? CHANGE_PASSWORD_PATH : LOGIN_PATH;
}
