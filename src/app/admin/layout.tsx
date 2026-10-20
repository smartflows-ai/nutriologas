// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import TrialBanner from "@/components/admin/TrialBanner";
import TrialExpiredGate from "@/components/admin/TrialExpiredGate";
import { TenantMetaProvider } from "@/components/admin/TenantMeta";
import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { getTrialDaysLeft, isTenantOnTrial, isSubscriptionBlocked } from "@/lib/trial";
import { themeColorVars } from "@/lib/theme-vars";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  const tenantId = session.user.tenantId;
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
    <TenantMetaProvider value={{ vertical: tenant?.vertical ?? "ECOMMERCE", isBookingEnabled: tenant?.isBookingEnabled ?? true }}>
    <div
      className="flex flex-col h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden"
      style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />

      {/* Trial expired gate — full-screen blocking overlay */}
      {showExpiredGate && <TrialExpiredGate status={sub!.status} />}

      {/* Trial countdown banner */}
      {showTrialBanner && !showExpiredGate && <TrialBanner daysLeft={trialDaysLeft} />}

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar 
          userName={session.user?.name ?? session.user?.email} 
          isAssistantEnabled={tenant?.isAssistantEnabled ?? false}
          isTriageEnabled={tenant?.isTriageEnabled ?? false}
          isBookingEnabled={tenant?.isBookingEnabled ?? true}
          vertical={tenant?.vertical ?? "ECOMMERCE"}
          connectedApps={tenant?.connectedApps.map(a => a.provider) ?? []}
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
