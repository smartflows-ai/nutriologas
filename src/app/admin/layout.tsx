// src/app/admin/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { prisma } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") redirect("/login");

  const tenantId = (session.user as any).tenantId;
  const tenant = await prisma.tenant.findUnique({ 
    where: { id: tenantId }, 
    include: { theme: true, connectedApps: true } 
  });
  const theme = tenant?.theme;

  const pColor = (theme as any)?.primaryColor || "#16a34a";
  const sColor = (theme as any)?.secondaryColor || "#15803d";
  const fFamily = (theme as any)?.fontFamily || "Inter, sans-serif";

  const dynamicStyles = `
    :root {
      --color-primary: ${pColor};
      --color-secondary: ${sColor};
      --font-family-base: ${fFamily};
    }
  `;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden" style={{ fontFamily: 'var(--font-family-base), system-ui, sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      <AdminSidebar 
        userName={session.user?.name ?? session.user?.email} 
        isAssistantEnabled={tenant?.isAssistantEnabled ?? false}
        connectedApps={tenant?.connectedApps.map(a => a.provider) ?? []}
      />

      {/* Main content — pt-16 on mobile to clear the hamburger button */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-8 md:px-6 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
