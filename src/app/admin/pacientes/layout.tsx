// src/app/admin/pacientes/layout.tsx
// Plan guard for the patients module (registry id "patients", Pro). Redirects lower plans to billing.
import { redirectIfPlanLocked } from "@/lib/capability-guard";
import { getAppSession } from "@/lib/session";

export default async function PatientsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (session?.user.tenantId) await redirectIfPlanLocked(session.user.tenantId, "patients");
  return <>{children}</>;
}
