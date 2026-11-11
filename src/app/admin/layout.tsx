// src/app/admin/layout.tsx
import AdminSidebar from "@/components/admin/AdminSidebar";
import SessionWatch from "@/components/admin/SessionWatch";
import TrialBanner from "@/components/admin/TrialBanner";
import TrialExpiredGate from "@/components/admin/TrialExpiredGate";
import { TenantMetaProvider } from "@/components/admin/TenantMeta";
import { prisma } from "@/lib/db";
import { requireCrmSession } from "@/lib/permission-guard";
import { ADMIN_ROLE } from "@/lib/permissions";
import { getTrialDaysLeft, isTenantOnTrial, isSubscriptionBlocked } from "@/lib/trial";
import { themeColorVars } from "@/lib/theme-vars";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Only checks the account may enter the CRM (active, no pending password change, CRM role): a layout does
  // not receive the path. Sections are gated by src/middleware.ts, by each server page (requireAdminPage)
  // and, for data, by each API route.
  const session = await requireCrmSession();

  const tenantId = session.user.tenantId;
  const role = session.user.role;
  // Billing (credits, subscription) is ADMIN only; STAFF is told to talk to the business owner instead.
  const canManageBilling = role === ADMIN_ROLE;
  const tenant = await prisma.tenant.findUnique({ 
    where: { id: tenantId }, 
    include: { theme: true, connectedApps: true, subscription: true } 
  });
  const theme = tenant?.theme;
  const sub   = tenant?.subscription;

  // ── Trial/billing state ──────────────────────────────────────
  const showTrialBanner = sub && isTenantOnTrial(sub.status, sub.trialEndsAt);
  const trialDaysLeft   = sub ? getTrialDaysLeft(sub.trialEndsAt) : 0;
  const showExpiredGate = sub && isSubscriptionBlocked(sub.status, sub.trialEndsAt);

  const pColor  = (theme as any)?.primaryColor  || "#16a34a";
  const sColor  = (theme as any)?.secondaryColor || "#15803d";
  const aColor  = (theme as any)?.accentColor    || "#4ade80";
  const fFamily = (theme as any)?.fontFamily     || "Inter, sans-serif";

  const dynamicStyles = `
    :root {
      ${Object.entries(themeColorVars({ primaryColor: pColor, secondaryColor: sColor, accentColor: aColor }))
        .map(([key, value]) => `${key}: ${value};`)
        .join("\n      ")}
      --font-family-base: ${fFamily};
    }
    body {
      font-family: var(--font-family-base), system-ui, sans-serif;
    }
  `;

  return (
    <TenantMetaProvider value={{ vertical: tenant?.vertical ?? "ECOMMERCE", isBookingEnabled: tenant?.isBookingEnabled ?? true, serviceModes: tenant?.serviceModes ?? "IN_PERSON", role }}>
    <div
      className="flex flex-col h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden"
      style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      {/* Re-checks the account on every section change (the layout itself only runs on a full load) */}
      <SessionWatch />

      {/* Trial expired gate — full-screen blocking overlay */}
      {showExpiredGate && <TrialExpiredGate status={sub!.status} canManageBilling={canManageBilling} />}

      {/* Trial countdown banner */}
      {showTrialBanner && !showExpiredGate && <TrialBanner daysLeft={trialDaysLeft} canManageBilling={canManageBilling} />}

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar 
          userName={session.user?.name ?? session.user?.email}
          role={role}
          tenantName={tenant?.name ?? ""}
          isAssistantEnabled={tenant?.isAssistantEnabled ?? false}
          isTriageEnabled={tenant?.isTriageEnabled ?? false}
          isBookingEnabled={tenant?.isBookingEnabled ?? true}
          vertical={tenant?.vertical ?? "ECOMMERCE"}
          plan={sub?.plan ?? "STARTER"}
          connectedApps={tenant?.connectedApps.map(a => a.provider) ?? []}
          enabledTools={tenant?.enabledTools ?? []}
        />

        {/* Main content — pt-16 on mobile to clear the hamburger button */}
        <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-6xl mx-auto px-4 pt-16 pb-8 md:px-6 md:pt-8">
            {children}
          </div>
        </main>
      </div>
    </div>
    </TenantMetaProvider>
  );
}
