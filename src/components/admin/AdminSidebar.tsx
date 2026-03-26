"use client";
// src/components/admin/AdminSidebar.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Image,
  Palette,
  Calendar,
  Star,
  Bot,
  LogOut,
  Menu,
  X,
  Plug,
  MessageSquare,
  HelpCircle
} from "lucide-react";
import SignOutButton from "@/components/admin/SignOutButton";

const navItems = [
  { href: "/admin/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/admin/productos",  label: "Productos",    icon: Package },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/carrusel",   label: "Carrusel",     icon: Image },
  { href: "/admin/apariencia", label: "Apariencia",   icon: Palette },
  { href: "/admin/calendario", label: "Calendario",   icon: Calendar },
  { href: "/admin/reviews",    label: "Reviews",      icon: Star },
  { href: "/admin/apps",       label: "Apps",         icon: Plug },
  { href: "/admin/whatsapp",   label: "WhatsApp",     icon: MessageSquare },
  { href: "/admin/faq",        label: "FAQ",          icon: HelpCircle },
  { href: "/admin/asistente",  label: "Asistente IA", icon: Bot },
];

interface Props {
  userName?: string | null;
}

export default function AdminSidebar({ userName }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile nav)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white/70 dark:bg-gray-950/70 backdrop-blur-md border-r border-gray-100 dark:border-transparent">
      {/* Brand + close button (mobile only) */}
      <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-primary tracking-tight">CRM Nutrición</h1>
          <p className="text-xs text-gray-400 font-medium truncate max-w-[160px] uppercase mt-0.5">{userName}</p>
        </div>
        <button
          className="md:hidden p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative
                ${active
                  ? "bg-gradient-to-r from-green-100/50 dark:from-primary/10 to-transparent text-primary font-semibold shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:text-white dark:hover:text-gray-200"}`}
            >
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />}
              <Icon
                size={18}
                className={active ? "text-primary" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-300 transition-colors"}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4">
        <SignOutButton>
          <LogOut size={18} /> Cerrar sesión
        </SignOutButton>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile: hamburger button (top-left) ── */}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2.5 bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* ── Mobile: backdrop overlay ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile: slide-in drawer ── */}
      <aside
        className={`
          md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-gray-950 shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* ── Desktop: static sidebar ── */}
      <aside className="hidden md:flex md:flex-col w-64 border-r border-white/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex-shrink-0 z-10 relative">
        {sidebarContent}
      </aside>
    </>
  );
}
