// src/app/admin/layout.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  LayoutDashboard, Package, Image, Palette,
  Calendar, Star, Bot, LogOut
} from "lucide-react";
import SignOutButton from "@/components/admin/SignOutButton";

const navItems = [
  { href: "/admin/dashboard",  label: "Dashboard",   icon: LayoutDashboard },
  { href: "/admin/productos",  label: "Productos",   icon: Package },
  { href: "/admin/carrusel",   label: "Carrusel",    icon: Image },
  { href: "/admin/apariencia", label: "Apariencia",  icon: Palette },
  { href: "/admin/calendario", label: "Calendario",  icon: Calendar },
  { href: "/admin/reviews",    label: "Reviews",     icon: Star },
  { href: "/admin/asistente",  label: "Asistente IA",icon: Bot },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") redirect("/login");

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="font-bold text-lg text-primary">CRM Nutrición</h1>
          <p className="text-xs text-gray-400 truncate">{session.user?.name ?? session.user?.email}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors group"
            >
              <Icon size={18} className="text-gray-400 group-hover:text-primary transition-colors" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <SignOutButton>
            <LogOut size={18} /> Cerrar sesión
          </SignOutButton>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
