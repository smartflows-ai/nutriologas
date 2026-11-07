// src/app/admin/page.tsx
// CRM entry: ADMIN goes to the dashboard; STAFF goes to the first section the business offers,
// or sees the empty screen when there is none (never a redirect loop).
import { redirect } from "next/navigation";
import StaffNoSections from "@/components/admin/StaffNoSections";
import { getTranslationServer } from "@/i18n/server";
import { capabilityContextForTenant } from "@/lib/capability-guard";
import { requireAdminPage } from "@/lib/permission-guard";
import { ADMIN_ROLE, roleHomePath, staffHomePath } from "@/lib/permissions";

export default async function AdminPage() {
  const session = await requireAdminPage("/admin");
  if (session.user.role === ADMIN_ROLE) redirect(roleHomePath(ADMIN_ROLE));

  const ctx = await capabilityContextForTenant(session.user.tenantId);
  const home = ctx ? staffHomePath(ctx) : null;
  if (home) redirect(home);

  return <StaffNoSections t={getTranslationServer()} />;
}
