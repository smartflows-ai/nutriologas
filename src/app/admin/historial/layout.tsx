// src/app/admin/historial/layout.tsx
// Plan guard for the visit history (registry id "history", Plus). Redirects STARTER tenants to billing.
import { redirectIfPlanLocked } from "@/lib/capability-guard";
import { getAppSession } from "@/lib/session";

export default async function HistoryLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (session?.user.tenantId) await redirectIfPlanLocked(session.user.tenantId, "history");
  return <>{children}</>;
}
