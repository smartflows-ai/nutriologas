// src/lib/permission-guard.ts
// Server-side role checks (ticket #21). Sidebar hiding is not security: these guards are.
// tenantId always comes from the session token, never from the request.
import { getServerSession, type Session } from "next-auth";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api-errors";
import { canAccessAdminPath, isCrmRole, permissionStatus, type Permission } from "@/lib/permissions";
import { getAppSession, type AppSession } from "@/lib/session";

// Codes the UI translates through t.apiErrors (src/lib/api-errors.ts).
const ERROR_BY_STATUS = { 401: "unauthorized", 403: "forbidden" } as const;
const LOGIN_PATH = "/login";
const ADMIN_ENTRY = "/admin";

export type PermissionResult =
  | { readonly ok: true; readonly session: Session; readonly tenantId: string; readonly role: string }
  | { readonly ok: false; readonly response: NextResponse };

// For API handlers: 401 without a session, 403 without the permission.
export async function requirePermission(permission: Permission): Promise<PermissionResult> {
  const session = await getServerSession(authOptions);
  const status = permissionStatus(session, permission);
  if (status !== null || !session) {
    const code = status ?? 401;
    return { ok: false, response: apiError(ERROR_BY_STATUS[code], code) };
  }
  return { ok: true, session, tenantId: session.user.tenantId, role: session.user.role };
}

// Second gate for server pages that read the database directly (the middleware is the first).
// No session or a non-CRM role goes to login (as the admin layout does); STAFF outside its sections goes to /admin.
export async function requireAdminPage(pathname: string): Promise<AppSession> {
  const session = await getAppSession();
  if (!session || !isCrmRole(session.user.role)) redirect(LOGIN_PATH);
  if (!canAccessAdminPath(session.user.role, pathname)) redirect(ADMIN_ENTRY);
  return session;
}
