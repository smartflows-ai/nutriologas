// src/app/admin/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") redirect("/login");

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar userName={session.user?.name ?? session.user?.email} />

      {/* Main content — pt-16 on mobile to clear the hamburger button */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-8 md:px-6 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
