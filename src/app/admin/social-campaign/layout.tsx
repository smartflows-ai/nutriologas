// src/app/admin/social-campaign/layout.tsx
// Plan guard for social campaigns (registry id "social-campaign", Pro). Redirects lower plans to billing.
import { redirectIfPlanLocked } from "@/lib/capability-guard";
import { getAppSession } from "@/lib/session";

export default async function SocialCampaignLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (session?.user.tenantId) await redirectIfPlanLocked(session.user.tenantId, "social-campaign");
  return <>{children}</>;
}
