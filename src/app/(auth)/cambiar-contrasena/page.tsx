// src/app/(auth)/cambiar-contrasena/page.tsx
// A CRM user chooses their own password (ticket #22). A user that signed in with a temporary password can
// open nothing else until this is done. Not a full "My account" page.
import { redirect } from "next/navigation";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import { LOGIN_PATH } from "@/lib/account-state";
import { isCrmRole } from "@/lib/permissions";
import { getSessionAccess } from "@/lib/session";

const STORE_HOME = "/";

export default async function ChangePasswordPage() {
  const access = await getSessionAccess();
  if (access.kind === "none") redirect(LOGIN_PATH);
  // Customers have no password to manage here.
  if (access.kind === "active" && !isCrmRole(access.session.user.role)) redirect(STORE_HOME);
  return <ChangePasswordForm isForced={access.kind === "password_change"} />;
}
