// src/lib/oauth-refresh.ts
// Decides what a failed OAuth token refresh means, and how often a failing connection is retried.
// Only an answer that says the permission is gone (or that the customer must sign in again) removes the connection.
// A busy provider (429, 5xx), a bad client setting on our side or an unreadable answer say nothing about the
// permission, so the stored connection stays and is retried later, but not on every request.

const PERMANENT_STATUSES = [400, 401];

// "invalid_grant" is the refresh token revoked or expired (RFC 6749 section 5.2). The other two are Microsoft
// answers that only the customer can fix by signing in or consenting again: retrying never heals them.
const PERMANENT_ERRORS = ["invalid_grant", "interaction_required", "consent_required", "login_required"];

/** Longest a refresh call may take before it is given up as a temporary failure. */
export const REFRESH_TIMEOUT_MS = 8_000;

/** How long a connection that failed temporarily rests before the next refresh attempt. */
export const REFRESH_COOLDOWN_MS = 60_000;

/** True only when the provider says the customer's permission is gone and has to be granted again. */
export function isPermanentRefreshFailure(status: number, body: string): boolean {
  if (!PERMANENT_STATUSES.includes(status)) return false;
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return false;
    const error = (parsed as { error?: unknown }).error;
    return typeof error === "string" && PERMANENT_ERRORS.includes(error);
  } catch {
    return false;
  }
}

export interface RefreshCooldown {
  isCoolingDown(key: string): boolean;
  mark(key: string): void;
  clear(key: string): void;
}

/** Remembers, per key, when a refresh last failed temporarily. In memory: each server instance keeps its own. */
export function createRefreshCooldown(ttlMs: number, now: () => number = Date.now): RefreshCooldown {
  const failedAt = new Map<string, number>();
  return {
    isCoolingDown(key) {
      const at = failedAt.get(key);
      if (at === undefined) return false;
      if (now() - at >= ttlMs) {
        failedAt.delete(key);
        return false;
      }
      return true;
    },
    mark(key) {
      failedAt.set(key, now());
    },
    clear(key) {
      failedAt.delete(key);
    },
  };
}
